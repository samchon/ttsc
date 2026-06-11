import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  ITtscCompilerDiagnostic,
  ITtscCompilerTransformation,
} from "ttsc";
import { TtscCompiler } from "ttsc";
import type { TransformResult } from "unplugin";

import type { ResolvedTtscUnpluginOptions } from "./options";
import {
  absolutizePathsTarget,
  readEffectiveTsconfigPaths,
} from "./tsconfigPaths";

/**
 * The normalised transform result type that this module produces.
 *
 * Excludes the shorthand `string`, `null`, and `undefined` variants of
 * unplugin's `TransformResult` so callers always receive an object or
 * `undefined`.
 */
export type TtscTransformResult = Exclude<
  TransformResult,
  string | null | undefined
>;

/**
 * Normalised alias entry used when building the `paths` overlay for the
 * generated tsconfig. Derived from either a Vite array alias or a webpack/
 * Rspack object alias.
 */
export interface TtscTransformAlias {
  /** The alias key (module specifier prefix). */
  find: string;
  /** Absolute or cwd-relative path that the alias points to. */
  replacement: string;
}

/**
 * A single entry in the per-build transform cache.
 *
 * Stores the full compiler result together with SHA-256 hashes of every input
 * file. On subsequent transforms the cached entry is validated by comparing
 * fresh hashes against {@link inputHashes}; a mismatch triggers a full
 * re-transform of the project.
 */
export interface TtscCachedProjectTransform {
  /**
   * SHA-256 hash of each project-relative input path at the time of the
   * transform.
   */
  inputHashes: Record<string, string>;
  /** Absolute path to the directory that owns the tsconfig. */
  projectRoot: string;
  /** Raw compiler output returned by {@link TtscCompiler.transform}. */
  result: ITtscCompilerTransformation;
}

/**
 * Keyed by a stable JSON string that encodes the tsconfig path, compiler
 * options overlay, plugin list, and alias paths. The value is a `Promise` so
 * concurrent transforms for the same project share a single in-flight
 * compilation rather than spawning multiple `TtscCompiler` instances.
 */
export type TtscTransformCache = Map<
  string,
  Promise<TtscCachedProjectTransform>
>;

/** Create an empty transform cache for a single build session. */
export function createTtscTransformCache(): TtscTransformCache {
  return new Map();
}

/**
 * Hooks the bundler adapter passes into {@link transformTtsc} so transform
 * side-channels (currently the plugin-reported dependency list) reach the
 * bundler without leaking extra fields on the returned `TransformResult`.
 */
export interface TtscTransformHooks {
  /**
   * Invoked once per absolute dependency path the plugin reported for the
   * transformed file (`dependencies` in the transform envelope). Adapters
   * forward this to the bundler's `addWatchFile` so type-only inputs
   * participate in HMR invalidation.
   */
  addWatchFile?: (file: string) => void;
}

/**
 * Apply the ttsc plugin transform to a single source file.
 *
 * The function is intentionally project-scoped: it compiles the entire tsconfig
 * project in one shot and extracts the result for `id`. Subsequent calls for
 * sibling files in the same project reuse the cached result as long as none of
 * the project's input files have changed (verified by comparing SHA-256
 * hashes).
 *
 * Returns `undefined` when no transform is needed (declaration files, virtual
 * modules, disabled plugins, or source unchanged after transform).
 *
 * @param id - Bundler module id (may carry a query string or virtual prefix).
 * @param source - Current file content supplied by the bundler.
 * @param options - Resolved plugin options.
 * @param aliases - Raw bundler alias configuration (Vite array or webpack
 *   object).
 * @param cache - Optional per-build cache; cleared by the caller on
 *   `buildStart`.
 * @param hooks - Optional adapter callbacks; see {@link TtscTransformHooks}.
 *   Dependency notifications fire on cache hits too — watch registrations are
 *   per build, not per compilation.
 */
export async function transformTtsc(
  id: string,
  source: string,
  options: ResolvedTtscUnpluginOptions,
  aliases?: unknown,
  cache?: TtscTransformCache,
  hooks?: TtscTransformHooks,
): Promise<TtscTransformResult | undefined> {
  const clean = stripQuery(id);
  if (clean.includes("\0")) {
    return undefined;
  }
  const file = path.resolve(clean);
  if (isDeclarationFile(file)) {
    return undefined;
  }
  if (pluginsAreDisabled(options.plugins)) {
    return undefined;
  }

  const tsconfig = resolveTsconfig(file, options.project);
  const aliasPaths = createAliasPaths(aliases);
  const key = createTransformCacheKey({
    aliasPaths,
    compilerOptions: options.compilerOptions,
    plugins: options.plugins,
    tsconfig,
  });

  let transformed = cache?.get(key);
  if (transformed !== undefined) {
    const cached = await transformed;
    if (matchesCachedSource(cached, file, source)) {
      reportSuccessDiagnostics(cached.result);
      const code = selectTransformedSource({
        file,
        projectRoot: cached.projectRoot,
        result: cached.result,
      });
      notifyFileDependencies(hooks, {
        file,
        projectRoot: cached.projectRoot,
        result: cached.result,
      });
      return createTransformResult(source, code);
    }
    cache?.delete(key);
    transformed = undefined;
  }

  if (transformed === undefined) {
    transformed = transformProject({
      aliasPaths,
      compilerOptions: options.compilerOptions,
      currentFile: file,
      currentSource: source,
      plugins: options.plugins,
      tsconfig,
    });
    cache?.set(key, transformed);
  }
  const { projectRoot, result } = await transformed;
  reportSuccessDiagnostics(result);
  const code = selectTransformedSource({ file, projectRoot, result });
  notifyFileDependencies(hooks, { file, projectRoot, result });
  return createTransformResult(source, code);
}

/**
 * Forward the plugin-reported dependency list for `file` to the adapter's
 * `addWatchFile` hook.
 *
 * The transform envelope's `dependencies` keys mirror the `typescript` keys
 * (project-relative); values may be project-relative or absolute. Every path is
 * absolutized against the project root and deduplicated, and the file itself is
 * dropped — the bundler already watches the module it transforms.
 */
function notifyFileDependencies(
  hooks: TtscTransformHooks | undefined,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
  },
): void {
  const addWatchFile = hooks?.addWatchFile;
  if (addWatchFile === undefined) {
    return;
  }
  for (const dependency of selectFileDependencies(props)) {
    addWatchFile(dependency);
  }
}

/**
 * Extract the absolute, deduplicated dependency list for a single file from the
 * compiler result. Mirrors {@link selectTransformedSource}'s key lookup: fast
 * project-relative match first, then a resolve-based scan. Returns an empty
 * list on exceptions or when the plugin reported nothing.
 */
function selectFileDependencies(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): string[] {
  if (props.result.type === "exception") {
    return [];
  }
  const dependencies = props.result.dependencies;
  if (dependencies === undefined) {
    return [];
  }
  const key = toProjectKey(props.projectRoot, props.file);
  let entries = dependencies[key];
  if (entries === undefined) {
    for (const [candidate, candidateEntries] of Object.entries(dependencies)) {
      if (path.resolve(props.projectRoot, candidate) === props.file) {
        entries = candidateEntries;
        break;
      }
    }
  }
  if (!Array.isArray(entries)) {
    return [];
  }
  const output: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    const absolute = path.resolve(props.projectRoot, entry);
    if (absolute === props.file || seen.has(absolute)) {
      continue;
    }
    seen.add(absolute);
    output.push(absolute);
  }
  return output;
}

/**
 * Strip a query string or hash fragment from a bundler module id.
 *
 * Vite appends query parameters (e.g. `?raw`, `?url`, `?inline`) to
 * differentiate import variants of the same file. We must strip them before
 * using the id as a file-system path.
 */
export function stripQuery(id: string): string {
  const query = id.search(/[?#]/);
  return query === -1 ? id : id.slice(0, query);
}

/**
 * Returns `true` for TypeScript declaration files (`.d.ts`, `.d.mts`,
 * `.d.cts`).
 */
export function isDeclarationFile(id: string): boolean {
  return id.endsWith(".d.ts") || id.endsWith(".d.mts") || id.endsWith(".d.cts");
}

/**
 * Returns `true` when the caller has explicitly opted out of all plugins. An
 * empty array is treated as disabled so we don't invoke the compiler for a
 * no-op transform.
 */
function pluginsAreDisabled(
  plugins: ResolvedTtscUnpluginOptions["plugins"],
): boolean {
  return plugins === false || (Array.isArray(plugins) && plugins.length === 0);
}

/**
 * Build the unplugin transform result, or `undefined` when the transform
 * produced no changes.
 *
 * Returning `undefined` instead of `{ code: source }` lets the bundler skip the
 * unnecessary module update and preserves the original source map.
 */
export function createTransformResult(
  source: string,
  code: string,
): TtscTransformResult | undefined {
  if (source === code) {
    return undefined;
  }
  return { code };
}

function matchesCachedSource(
  cached: TtscCachedProjectTransform,
  file: string,
  source: string,
): boolean {
  const currentKey = toProjectKey(cached.projectRoot, file);
  const currentHashes = collectProjectInputHashes(cached.projectRoot);
  currentHashes[currentKey] = hashText(source);
  return sameHashes(cached.inputHashes, currentHashes);
}

/**
 * Build the complete input-hash snapshot stored alongside a fresh compiler
 * result.
 *
 * Combines filesystem hashes for every file in the project directory with
 * hashes for each emitted TypeScript output key (the compiler may have read
 * files not visible via the directory walk). The in-memory source for the file
 * that triggered the build is overlaid last to capture unsaved editor content
 * correctly.
 */
function collectInputHashes(props: {
  currentFile: string;
  currentSource: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): Record<string, string> {
  const hashes = collectProjectInputHashes(props.projectRoot);
  if (props.result.type !== "exception") {
    for (const key of Object.keys(props.result.typescript)) {
      const file = path.resolve(props.projectRoot, key);
      try {
        hashes[key] = hashText(fs.readFileSync(file, "utf8"));
      } catch {
        // A plugin may synthesize a virtual TypeScript file. It should not
        // decide cache reuse for real source files.
      }
    }
  }
  // Overlay the in-memory source so unsaved edits invalidate the cache.
  hashes[toProjectKey(props.projectRoot, props.currentFile)] = hashText(
    props.currentSource,
  );
  return hashes;
}

function collectProjectInputHashes(
  projectRoot: string,
): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const file of listProjectInputFiles(projectRoot)) {
    try {
      hashes[toProjectKey(projectRoot, file)] = hashText(fs.readFileSync(file));
    } catch {
      // File watchers may observe a transform while another process is moving
      // or deleting files. The missing key invalidates older cache entries.
    }
  }
  return hashes;
}

/**
 * Enumerate every regular file under `root`, skipping well-known output and
 * tooling directories (see {@link isIgnoredProjectDirectory}).
 *
 * Uses an iterative DFS instead of `fs.readdirSync` recursion to avoid
 * unbounded call-stack depth on deep project trees. The result is sorted so
 * that hash comparisons are deterministic across OS-level directory orderings.
 */
function listProjectInputFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (isIgnoredProjectDirectory(entry.name)) {
        continue;
      }
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(file);
      } else if (entry.isFile()) {
        out.push(file);
      }
    }
  }
  out.sort();
  return out;
}

function isIgnoredProjectDirectory(name: string): boolean {
  return (
    name === ".git" ||
    name === ".ttsc" ||
    name === ".cache" ||
    name === ".next" ||
    name === ".nuxt" ||
    name === ".svelte-kit" ||
    name === ".turbo" ||
    name === ".vite" ||
    name === "build" ||
    name === "coverage" ||
    name === "dist" ||
    name === "node_modules" ||
    name === "out" ||
    name === "temp" ||
    name === "tmp"
  );
}

function sameHashes(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => right[key] === left[key]);
}

function hashText(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function transformProject(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  currentFile: string;
  currentSource: string;
  plugins?: ResolvedTtscUnpluginOptions["plugins"];
  tsconfig: string;
}): Promise<TtscCachedProjectTransform> {
  const configured = createTransformTsconfig(props);
  const projectRoot = path.dirname(props.tsconfig);
  try {
    const result = new TtscCompiler({
      cwd: projectRoot,
      plugins: props.plugins,
      projectRoot,
      tsconfig: configured.path,
    }).transform();
    return {
      inputHashes: collectInputHashes({
        currentFile: props.currentFile,
        currentSource: props.currentSource,
        projectRoot,
        result,
      }),
      projectRoot,
      result,
    };
  } finally {
    configured.dispose();
  }
}

function createTransformTsconfig(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  tsconfig: string;
}): { path: string; dispose: () => void } {
  const compilerOptions = normalizeCompilerOptionsForGeneratedTsconfig(
    {
      ...props.compilerOptions,
      ...createAliasCompilerOptions(props),
    },
    path.dirname(props.tsconfig),
  );
  if (Object.keys(compilerOptions).length === 0) {
    return {
      path: props.tsconfig,
      dispose: () => undefined,
    };
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-unplugin-"));
  const file = path.join(directory, "tsconfig.json");
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        extends: normalizePath(props.tsconfig),
        compilerOptions,
      },
      null,
      2,
    ),
    "utf8",
  );
  return {
    path: file,
    dispose: () => fs.rmSync(directory, { force: true, recursive: true }),
  };
}

/**
 * Resolve all relative paths inside `compilerOptions` against `tsconfigDir`.
 *
 * The generated tsconfig lives in a system temp directory, so any relative path
 * (e.g. `"outDir": "../dist"`) that was meaningful relative to the original
 * tsconfig must be converted to an absolute path before writing the generated
 * file. Otherwise TypeScript-Go resolves it against the temp dir.
 *
 * `paths` targets are absolutized for the same reason, with the extra twist
 * that TypeScript-Go rejects bare non-relative targets outright (TS5090) and
 * has removed `baseUrl` (TS5102), so anchoring them as absolute paths is the
 * only temp-dir-safe encoding. No synthetic `baseUrl` is ever written.
 */
function normalizeCompilerOptionsForGeneratedTsconfig(
  compilerOptions: Record<string, unknown>,
  tsconfigDir: string,
): Record<string, unknown> {
  const output = { ...compilerOptions };
  // Scalar path fields: resolve each against the original tsconfig directory.
  for (const key of ["declarationDir", "outDir", "rootDir"]) {
    if (typeof output[key] === "string") {
      output[key] = path.resolve(tsconfigDir, output[key]);
    }
  }
  // Array path fields: resolve each element individually.
  for (const key of ["rootDirs", "typeRoots"]) {
    if (Array.isArray(output[key])) {
      output[key] = output[key].map((entry) =>
        typeof entry === "string" ? path.resolve(tsconfigDir, entry) : entry,
      );
    }
  }
  const paths = readPaths(output.paths);
  if (Object.keys(paths).length !== 0) {
    output.paths = Object.fromEntries(
      Object.entries(paths).map(([key, targets]) => [
        key,
        targets.map((target) => absolutizePathsTarget(tsconfigDir, target)),
      ]),
    );
  }
  if (Array.isArray(output.plugins)) {
    output.plugins = output.plugins.map((entry) =>
      normalizePluginConfigForGeneratedTsconfig(entry, tsconfigDir),
    );
  }
  return output;
}

function normalizePluginConfigForGeneratedTsconfig(
  entry: unknown,
  tsconfigDir: string,
): unknown {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return entry;
  }
  const output: Record<string, unknown> = { ...entry };
  for (const key of ["config", "source", "transform"]) {
    const value = output[key];
    if (typeof value === "string" && isRelativeSpecifier(value)) {
      output[key] = path.resolve(tsconfigDir, value);
    }
  }
  return output;
}

/**
 * Build the `paths` overlay that forwards bundler aliases to the compiler.
 *
 * Because the generated tsconfig `extends` the project one and TypeScript
 * merges `compilerOptions` per option key, declaring `paths` here replaces the
 * project's own `paths` wholesale. The overlay therefore re-states the
 * project's effective mappings first, so tsconfig-only aliases keep resolving;
 * inline `compilerOptions.paths` from the plugin options ride on top, and the
 * bundler aliases win last — they mirror what the bundler will actually do at
 * resolve time.
 *
 * No `baseUrl` is emitted: TypeScript-Go removed the option (TS5102), and all
 * targets are absolute so none is needed.
 */
function createAliasCompilerOptions(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  tsconfig: string;
}): Record<string, unknown> {
  if (Object.keys(props.aliasPaths).length === 0) {
    return {};
  }
  return {
    paths: {
      ...readEffectiveTsconfigPaths(props.tsconfig),
      ...readPaths(props.compilerOptions.paths),
      ...props.aliasPaths,
    },
  };
}

function readPaths(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const output: Record<string, string[]> = {};
  for (const [key, paths] of Object.entries(value)) {
    if (!Array.isArray(paths)) {
      continue;
    }
    const filtered = paths.filter(
      (entry): entry is string => typeof entry === "string",
    );
    if (filtered.length !== 0) {
      output[key] = filtered;
    }
  }
  return output;
}

/**
 * Convert bundler aliases into absolute `paths` mappings.
 *
 * Targets are written as absolute paths on purpose: the generated tsconfig
 * lives in a system temp directory, where TypeScript-Go would reject bare
 * relative targets (TS5090) and anchor `./`-style ones at the wrong directory.
 */
function createAliasPaths(aliases: unknown): Record<string, string[]> {
  const paths: Record<string, string[]> = {};
  for (const alias of normalizeAliases(aliases)) {
    if (typeof alias.find !== "string" || alias.find.length === 0) {
      continue;
    }
    if (alias.find.includes("*")) {
      continue;
    }
    const key = alias.find.replace(/\/+$/, "");
    if (key.length === 0) {
      continue;
    }
    const target = normalizePath(
      path.isAbsolute(alias.replacement)
        ? alias.replacement
        : path.resolve(process.cwd(), alias.replacement),
    );
    paths[key] = [target];
    paths[`${key}/*`] = [`${target}/*`];
  }
  return paths;
}

function normalizeAliases(aliases: unknown): TtscTransformAlias[] {
  if (Array.isArray(aliases)) {
    return aliases.filter(isAlias);
  }
  if (typeof aliases === "object" && aliases !== null) {
    return Object.entries(aliases)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      )
      .map(([find, replacement]) => ({ find, replacement }));
  }
  return [];
}

function createTransformCacheKey(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  plugins?: ResolvedTtscUnpluginOptions["plugins"];
  tsconfig: string;
}): string {
  return stableStringify({
    aliasPaths: props.aliasPaths,
    compilerOptions: props.compilerOptions,
    plugins: props.plugins,
    tsconfig: path.resolve(props.tsconfig),
  });
}

/**
 * JSON-serialise `value` with object keys sorted alphabetically.
 *
 * Standard `JSON.stringify` does not guarantee key ordering, so two
 * semantically identical option objects could produce different strings and
 * cause unnecessary cache misses. Sorting keys makes the cache key stable
 * regardless of the order properties were added to the options object.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isRelativeSpecifier(value: string): boolean {
  return (
    value === "." ||
    value === ".." ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith(".\\") ||
    value.startsWith("..\\")
  );
}

function isAlias(value: unknown): value is TtscTransformAlias {
  return (
    typeof value === "object" &&
    value !== null &&
    "find" in value &&
    "replacement" in value &&
    typeof value.find === "string" &&
    typeof value.replacement === "string"
  );
}

/**
 * Extract the transformed source for a single file from the compiler result.
 *
 * Throws on compiler exception or hard failure so the bundler surfaces the
 * error to the user. On success, tries a fast exact-match lookup by
 * project-relative key first, then falls back to a resolve-based scan for the
 * rare case where the key in `result.typescript` uses an absolute or
 * differently-cased path.
 */
function selectTransformedSource(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): string {
  if (props.result.type === "exception") {
    throw new Error(formatUnknownError(props.result.error));
  }
  if (props.result.type === "failure") {
    throw new Error(formatDiagnostics(props.result.diagnostics));
  }

  // Fast path: the compiler key matches the normalised project-relative path.
  const key = toProjectKey(props.projectRoot, props.file);
  const direct = props.result.typescript[key];
  if (direct !== undefined) {
    return direct;
  }
  // Slow path: resolve each candidate to an absolute path for comparison.
  for (const [candidate, source] of Object.entries(props.result.typescript)) {
    if (path.resolve(props.projectRoot, candidate) === props.file) {
      return source;
    }
  }
  throw new Error(`ttsc transform did not return output for ${props.file}`);
}

/**
 * Forward non-fatal plugin diagnostics to stderr.
 *
 * A `success` result may still carry warnings or informational messages from
 * plugins. These are surfaced via stderr rather than throwing so the build
 * continues. Failures and exceptions are handled by the caller.
 */
function reportSuccessDiagnostics(result: ITtscCompilerTransformation): void {
  if (result.type !== "success" || result.diagnostics === undefined) {
    return;
  }
  const text = formatDiagnostics(result.diagnostics);
  if (text.length !== 0) {
    process.stderr.write(`${text}\n`);
  }
}

/**
 * Format a compiler diagnostic list into a human-readable string.
 *
 * Produces `"file: line:col: message"` entries joined by newlines, matching the
 * output style of `tsc`. When the list is empty (e.g. a failure with no
 * attached diagnostics) returns a generic fallback message so the thrown
 * `Error` is never empty.
 */
function formatDiagnostics(diagnostics: ITtscCompilerDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return "ttsc transform failed";
  }
  return diagnostics
    .map((diag) =>
      [
        diag.file ?? "ttsc",
        diag.line === undefined
          ? undefined
          : `${diag.line}:${diag.character ?? 1}`,
        diag.messageText,
      ]
        .filter((part) => part !== undefined && part !== "")
        .join(": "),
    )
    .join("\n");
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return String(error);
}

/**
 * Locate the tsconfig that should govern the transform for `file`.
 *
 * If `tsconfig` is supplied it is returned as-is (absolute) or resolved from
 * `process.cwd()` (relative). Otherwise the function walks ancestor directories
 * starting at `file`'s directory, returning the first `tsconfig.json` found.
 * Falls back to `<cwd>/tsconfig.json` when no ancestor contains one — the
 * compiler will error if that file does not exist, which is the correct
 * behavior for a mis-configured project.
 */
function resolveTsconfig(file: string, tsconfig?: string): string {
  if (tsconfig !== undefined) {
    return path.isAbsolute(tsconfig)
      ? tsconfig
      : path.resolve(process.cwd(), tsconfig);
  }

  let current = path.dirname(file);
  while (true) {
    const candidate = path.join(current, "tsconfig.json");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    // Reached filesystem root — stop walking.
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return path.resolve(process.cwd(), "tsconfig.json");
}

function toProjectKey(root: string, file: string): string {
  return normalizePath(path.relative(root, file));
}

function normalizePath(file: string): string {
  return file.replace(/\\/g, "/");
}
