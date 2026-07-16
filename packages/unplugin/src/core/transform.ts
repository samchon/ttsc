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
 * Stores the full compiler result together with SHA-256 hashes of every project
 * input file. On subsequent transforms the cached entry is validated by
 * re-hashing the project and comparing against {@link inputHashes}; a mismatch
 * triggers a full re-transform. Both sides hash the same set of files (the
 * project directory walk), so the comparison is meaningful; keying the
 * compiler's out-of-walk output paths on only one side is what made the cache
 * miss on every module.
 */
export interface TtscCachedProjectTransform {
  /**
   * SHA-256 hash of every input the compiler reported outside the project walk
   * (keyed by absolute path), captured at the time of the transform.
   *
   * The project walk cannot see files outside the project root or under ignored
   * directories (`node_modules` declarations, monorepo sibling sources,
   * out-of-root tsconfig `extends` ancestry), yet the host-owned reference
   * graph proves they are transform inputs. Long-lived hosts that never clear
   * the cache between builds (Metro workers, the Turbopack loader, Bun) would
   * otherwise replay a project transform computed against a stale out-of-walk
   * input for the whole process lifetime; per-build hosts clear the cache on
   * `buildStart` and never replay across edits.
   */
  externalInputHashes?: Record<string, string>;
  /**
   * SHA-256 hash of each project-relative input path at the time of the
   * transform.
   */
  inputHashes: Record<string, string>;
  /** Absolute path to the directory that owns the tsconfig. */
  projectRoot: string;
  /** Raw compiler output returned by {@link TtscCompiler.transform}. */
  result: ITtscCompilerTransformation;
  /**
   * Absolute path of the generated temp-dir tsconfig this compile ran against,
   * when an alias/compiler-options overlay required one. The compiler reports
   * it in the envelope's `graph.configs` chain, but it is disposed right after
   * the compile, so registering it as a watch input would invalidate every
   * bundler cache snapshot on the next build; watch derivation must skip
   * exactly this path.
   */
  temporaryTsconfig?: string;
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
   * Invoked once per absolute watch-input path derived for the transformed file
   * `F`: the plugin-reported `dependencies[F]` list unioned with the host-owned
   * reference graph's contribution — the reachability closure of `graph.edges`
   * from `F`, the `graph.globals` files, and the `graph.configs` chain.
   * Adapters forward this to the bundler's `addWatchFile` so type-only inputs
   * participate in watch-mode and persistent-cache invalidation.
   */
  addWatchFile?: (file: string) => void;
  /**
   * Invoked when the plugin declared the transformed file volatile (the
   * envelope's `volatile` list): its output depends on non-file inputs that no
   * file-dependency snapshot can represent. Adapters should mark the module
   * uncacheable where the bundler exposes that control (e.g. a webpack loader
   * context's `cacheable(false)`).
   */
  markVolatile?: () => void;
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
 *   Dependency notifications fire on cache hits too; watch registrations are
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
    // A rejected in-flight generation must not stay cached: evict it (only if
    // it is still the current entry) so a later call re-runs the transform.
    const cached = await awaitOrEvict(cache, key, transformed);
    if (
      // A file the plugin declared volatile must never be served from the
      // cache: its output depends on non-file inputs, so the input-hash
      // snapshot cannot prove freshness. Fall through to a fresh transform.
      !isVolatileFile({
        file,
        projectRoot: cached.projectRoot,
        result: cached.result,
      }) &&
      matchesCachedSource(cached, file, source)
    ) {
      reportSuccessDiagnostics(cached.result);
      // A resolved `"exception"` / `"failure"` envelope makes this throw; that
      // is a failed generation too, so evict before surfacing it.
      const code = selectOrEvict(cache, key, transformed, {
        file,
        projectRoot: cached.projectRoot,
        result: cached.result,
      });
      notifyWatchInputs(hooks, {
        file,
        projectRoot: cached.projectRoot,
        result: cached.result,
        temporaryTsconfig: cached.temporaryTsconfig,
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
  const generation = transformed;
  const { projectRoot, result, temporaryTsconfig } = await awaitOrEvict(
    cache,
    key,
    generation,
  );
  reportSuccessDiagnostics(result);
  const code = selectOrEvict(cache, key, generation, {
    file,
    projectRoot,
    result,
  });
  notifyWatchInputs(hooks, { file, projectRoot, result, temporaryTsconfig });
  if (isVolatileFile({ file, projectRoot, result })) {
    hooks?.markVolatile?.();
  }
  return createTransformResult(source, code);
}

/**
 * Await a cached generation, evicting it on rejection.
 *
 * The cache stores the in-flight transform Promise before it settles so
 * concurrent callers share one compilation. A rejected generation must not
 * remain the authoritative cached result, or a transient toolchain/host failure
 * becomes permanent for a long-lived worker. Eviction is identity-guarded so a
 * newer generation another caller installed under the same key survives.
 */
async function awaitOrEvict(
  cache: TtscTransformCache | undefined,
  key: string,
  generation: Promise<TtscCachedProjectTransform>,
): Promise<TtscCachedProjectTransform> {
  try {
    return await generation;
  } catch (error) {
    evictGeneration(cache, key, generation);
    throw error;
  }
}

/**
 * Extract the transformed source, evicting the generation when the result is a
 * host `"exception"` or compiler `"failure"` (which makes
 * {@link selectTransformedSource} throw). Such a failed generation must not be
 * replayed to later callers of an unchanged module.
 */
function selectOrEvict(
  cache: TtscTransformCache | undefined,
  key: string,
  generation: Promise<TtscCachedProjectTransform>,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
  },
): string {
  try {
    return selectTransformedSource(props);
  } catch (error) {
    evictGeneration(cache, key, generation);
    throw error;
  }
}

/**
 * Delete a failed generation from the cache only when it is still the entry
 * stored under `key`. The identity check prevents an older failed generation's
 * cleanup from removing a newer replacement created by another caller for the
 * same key.
 */
function evictGeneration(
  cache: TtscTransformCache | undefined,
  key: string,
  generation: Promise<TtscCachedProjectTransform>,
): void {
  if (cache?.get(key) === generation) {
    cache.delete(key);
  }
}

/**
 * Forward every derived watch input for `file` to the adapter's `addWatchFile`
 * hook: the plugin-reported `dependencies[file]` list unioned with the
 * host-owned reference graph's contribution (`reach(edges, file)`, `globals`,
 * `configs`).
 *
 * Envelope keys mirror the `typescript` keys (project-relative); values may be
 * project-relative or absolute. Every path is absolutized against the project
 * root and deduplicated; the file itself is dropped (the bundler already
 * watches the module it transforms), and so is the disposed temp-dir tsconfig
 * (see {@link TtscCachedProjectTransform.temporaryTsconfig}).
 */
function notifyWatchInputs(
  hooks: TtscTransformHooks | undefined,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
    temporaryTsconfig?: string;
  },
): void {
  const addWatchFile = hooks?.addWatchFile;
  if (addWatchFile === undefined) {
    return;
  }
  for (const input of selectWatchInputs(props)) {
    addWatchFile(input);
  }
}

/**
 * Derive the absolute, deduplicated watch-input list for a single file:
 * `dependencies[file] ∪ reach(edges, file) ∪ globals ∪ configs`. Union
 * semantics on purpose — the plugin-reported list can only widen the host-owned
 * bound, never narrow it. Returns an empty list on exceptions.
 */
function selectWatchInputs(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  temporaryTsconfig?: string;
}): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  const excluded = new Set(
    props.temporaryTsconfig === undefined
      ? [props.file]
      : [props.file, path.resolve(props.temporaryTsconfig)],
  );
  for (const absolute of [
    ...selectFileDependencies(props),
    ...selectGraphInputs(props),
  ]) {
    if (excluded.has(absolute) || seen.has(absolute)) {
      continue;
    }
    seen.add(absolute);
    output.push(absolute);
  }
  return output;
}

/**
 * Flatten the host-owned reference graph for one file into absolute paths: the
 * reachability closure of `edges` starting at the file, plus every global-scope
 * file and the config chain. Flattening direct edges into a per-file list
 * happens here — at the adapter boundary — because bundler `fileDependencies`
 * snapshots are flat; the protocol itself carries only direct edges. Returns an
 * empty list on exceptions or without a graph.
 */
function selectGraphInputs(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): string[] {
  if (props.result.type === "exception") {
    return [];
  }
  const graph = props.result.graph;
  if (graph === undefined) {
    return [];
  }
  const output: string[] = [];
  const edges = new Map<string, string[]>();
  for (const [source, targets] of Object.entries(graph.edges ?? {})) {
    if (!Array.isArray(targets)) {
      continue;
    }
    edges.set(
      path.resolve(props.projectRoot, source),
      targets
        .filter(
          (target): target is string =>
            typeof target === "string" && target.length !== 0,
        )
        .map((target) => path.resolve(props.projectRoot, target)),
    );
  }
  const visited = new Set<string>([props.file]);
  const queue = [props.file];
  while (queue.length !== 0) {
    const current = queue.pop()!;
    for (const target of edges.get(current) ?? []) {
      if (visited.has(target)) {
        continue;
      }
      visited.add(target);
      queue.push(target);
      output.push(target);
    }
  }
  for (const listed of [graph.globals, graph.configs]) {
    if (!Array.isArray(listed)) {
      continue;
    }
    for (const entry of listed) {
      if (typeof entry !== "string" || entry.length === 0) {
        continue;
      }
      output.push(path.resolve(props.projectRoot, entry));
    }
  }
  return output;
}

/**
 * Report whether the plugin declared `file` volatile: its output depends on
 * non-file inputs (environment, time, network), so neither the project
 * transform cache nor a bundler's persistent cache may replay it.
 */
function isVolatileFile(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): boolean {
  if (props.result.type === "exception") {
    return false;
  }
  const volatile = props.result.volatile;
  if (!Array.isArray(volatile)) {
    return false;
  }
  return volatile.some(
    (entry) =>
      typeof entry === "string" &&
      entry.length !== 0 &&
      path.resolve(props.projectRoot, entry) === props.file,
  );
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

/**
 * Validate a cached project transform against the current on-disk project
 * state.
 *
 * Re-hashes every file under the project root and overlays the current module's
 * in-memory source, then compares the snapshot against the one captured when
 * the result was produced. Any input under the project root changing (the
 * module itself or a sibling the plugin reads) invalidates the entry and forces
 * a re-transform. Out-of-walk inputs the compiler reported (`node_modules`
 * declarations, sibling-package sources, out-of-root config ancestry) are
 * validated through {@link TtscCachedProjectTransform.externalInputHashes};
 * adapters additionally register them as derived watch inputs (the host-owned
 * `graph` union the reported `dependencies`) → `addWatchFile` → the bundler's
 * next `buildStart` cache clear.
 *
 * Both this snapshot and {@link collectInputHashes} draw their keys from the
 * exact same {@link collectProjectInputHashes} walk, so the two always agree on
 * the key universe. The earlier implementation overlaid the compiler's output
 * keys here on only one side; those keys include out-of-walk program inputs
 * (`node_modules` declarations, sibling-package sources), so the snapshots
 * never matched and the cache missed on every module; re-transforming the whole
 * project once per file on any project that imports a typed dependency.
 */
function matchesCachedSource(
  cached: TtscCachedProjectTransform,
  file: string,
  source: string,
): boolean {
  const currentKey = toProjectKey(cached.projectRoot, file);
  const currentHashes = collectProjectInputHashes(cached.projectRoot);
  currentHashes[currentKey] = hashText(source);
  if (!sameHashes(cached.inputHashes, currentHashes)) {
    return false;
  }
  // Re-hash the out-of-walk inputs the compiler reported for this generation
  // over exactly the recorded key universe, so an edit to a `node_modules`
  // declaration or a monorepo sibling source invalidates the entry even in a
  // host that never clears the cache between builds. A new out-of-walk input
  // cannot appear without some recorded input changing first: a new reference
  // edge requires editing an in-walk source, and a new global or config file
  // requires a tsconfig or package manifest change, both of which the project
  // walk above already detects.
  const externalHashes = cached.externalInputHashes ?? {};
  return sameHashes(
    externalHashes,
    collectExternalInputHashes(Object.keys(externalHashes)),
  );
}

/**
 * Build the input-hash snapshot stored alongside a fresh compiler result.
 *
 * Hashes every file under the project directory (the exact universe
 * {@link matchesCachedSource} re-hashes to validate), then overlays the
 * in-memory source for the module that triggered the compile so unsaved editor
 * content is captured correctly.
 *
 * Only the project's own files are hashed. Out-of-walk program inputs the
 * compiler also read (`node_modules` declarations, sibling-package sources) are
 * deliberately excluded: the validator never reproduces those keys, so keying
 * them here would make every snapshot comparison fail and the cache never hit.
 */
function collectInputHashes(props: {
  currentFile: string;
  currentSource: string;
  projectRoot: string;
}): Record<string, string> {
  const hashes = collectProjectInputHashes(props.projectRoot);
  // Overlay the in-memory source so unsaved edits invalidate the cache.
  hashes[toProjectKey(props.projectRoot, props.currentFile)] = hashText(
    props.currentSource,
  );
  return hashes;
}

/**
 * Hash every input file under `projectRoot` (the same walk universe
 * {@link matchesCachedSource} validates against), keyed by project-relative
 * slash path. Exported so hosts without a per-build boundary (`@ttsc/metro`)
 * can fold the identical input universe into their own cache fingerprints.
 */
export function collectProjectInputHashes(
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

/**
 * Report whether an absolute `file` belongs to the project walk universe of
 * `root`: it lies under `root` and no segment of the relative path (including
 * the basename) is an ignored directory name. The predicate mirrors
 * {@link listProjectInputFiles} exactly, so "walk-visible" here means "hashed by
 * {@link collectProjectInputHashes}". Anything else is an out-of-walk input that
 * only the reference graph can prove relevant.
 */
export function isProjectWalkPath(root: string, file: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return false;
  }
  return relative
    .split(path.sep)
    .every((segment) => !isIgnoredProjectDirectory(segment));
}

/**
 * Hash a list of absolute out-of-walk input paths: content SHA-256 for a
 * readable file, a stable `missing` marker otherwise. The marker is state, not
 * an error — a recorded input disappearing (or reappearing) must change the
 * comparison exactly like a content edit. Exported so `@ttsc/metro` can re-hash
 * its recorded snapshot with identical semantics at cache-key time.
 */
export function collectExternalInputHashes(
  paths: readonly string[],
): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const file of paths) {
    try {
      hashes[file] = hashText(fs.readFileSync(file));
    } catch {
      hashes[file] = "missing";
    }
  }
  return hashes;
}

/**
 * Derive the absolute out-of-walk input set of a whole project transform: the
 * union of every reference-graph member (edge keys and targets, globals, the
 * config chain) and every plugin-reported dependency, minus everything the
 * project walk already hashes and the disposed temp-dir tsconfig. These are the
 * inputs {@link matchesCachedSource}'s walk cannot see.
 */
function selectExternalInputPaths(props: {
  projectRoot: string;
  result: ITtscCompilerTransformation;
  temporaryTsconfig?: string;
}): string[] {
  if (props.result.type === "exception") {
    return [];
  }
  const members: string[] = [];
  const graph = props.result.graph;
  if (graph !== undefined) {
    for (const [source, targets] of Object.entries(graph.edges ?? {})) {
      members.push(source);
      if (Array.isArray(targets)) {
        members.push(...targets);
      }
    }
    for (const listed of [graph.globals, graph.configs]) {
      if (Array.isArray(listed)) {
        members.push(...listed);
      }
    }
  }
  for (const entries of Object.values(props.result.dependencies ?? {})) {
    if (Array.isArray(entries)) {
      members.push(...entries);
    }
  }
  const excluded =
    props.temporaryTsconfig === undefined
      ? undefined
      : path.resolve(props.temporaryTsconfig);
  const output: string[] = [];
  const seen = new Set<string>();
  for (const member of members) {
    if (typeof member !== "string" || member.length === 0) {
      continue;
    }
    const absolute = path.resolve(props.projectRoot, member);
    if (
      absolute === excluded ||
      seen.has(absolute) ||
      isProjectWalkPath(props.projectRoot, absolute)
    ) {
      continue;
    }
    seen.add(absolute);
    output.push(absolute);
  }
  output.sort();
  return output;
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
      // The generated tsconfig (if any) lives in the system temp directory,
      // so declare the real project as the plugin config anchor: utility
      // plugin config discovery (banner.config.*, strip.config.*,
      // lint.config.*) and relative configFile resolution walk the project,
      // never the temp tree. In the passthrough case this equals the
      // tsconfig's own directory, the default anchor.
      pluginConfigDir: projectRoot,
      plugins: props.plugins,
      projectRoot,
      tsconfig: configured.path,
    }).transform();
    const temporaryTsconfig =
      configured.path === props.tsconfig ? undefined : configured.path;
    return {
      // Capture the out-of-walk input hashes while the generation is fresh so
      // cache validation can re-check them; computed before dispose so the
      // exclusion of the temp-dir tsconfig is the only reason it never keys.
      externalInputHashes: collectExternalInputHashes(
        selectExternalInputPaths({ projectRoot, result, temporaryTsconfig }),
      ),
      inputHashes: collectInputHashes({
        currentFile: props.currentFile,
        currentSource: props.currentSource,
        projectRoot,
      }),
      projectRoot,
      result,
      // Remember the generated temp-dir tsconfig (disposed below) so watch
      // derivation can drop it from the envelope's config chain; a registered
      // but deleted file would invalidate every persistent-cache snapshot.
      ...(temporaryTsconfig === undefined ? {} : { temporaryTsconfig }),
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

/**
 * Absolutize the relative path-typed keys of one plugin entry before it is
 * written into the generated temp-dir tsconfig: `config`/`source`/`transform`
 * are the descriptor-resolution keys, and `configFile` is the config-file
 * override accepted by the shipped utility plugins (`@ttsc/banner`,
 * `@ttsc/strip`, `@ttsc/lint`). Left relative, each would resolve against the
 * temp directory instead of the project.
 */
function normalizePluginConfigForGeneratedTsconfig(
  entry: unknown,
  tsconfigDir: string,
): unknown {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return entry;
  }
  const output: Record<string, unknown> = { ...entry };
  for (const key of ["config", "configFile", "source", "transform"]) {
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
 * bundler aliases win last; they mirror what the bundler will actually do at
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
 * Falls back to `<cwd>/tsconfig.json` when no ancestor contains one; the
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
    // Reached filesystem root, stop walking.
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
