import crypto from "node:crypto";
import fs from "node:fs";
import { Module, registerHooks, stripTypeScriptTypes } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveEmittedJavaScript } from "../../compiler/internal/resolveEmittedJavaScript";
import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { runBuild } from "../../compiler/internal/runBuild";
import { outputText, spawnNative } from "../../compiler/internal/spawnNative";

/**
 * Synchronous Node module hooks installed (via `module.registerHooks`) in the
 * child process `ttsx` spawns to run a TypeScript entry _from source_.
 *
 * They give the runner ts-node-style whole-graph reach without weakening the
 * compile gate. The owning entry project is type-checked and built up front (by
 * `prepareExecution`, with its transform plugins such as typia); these hooks
 * serve that build under the source URLs so `__dirname`/`import.meta.url` keep
 * pointing at the source tree. Three load paths:
 *
 * 1. A `.ts` belonging to the entry project → serve the pre-built emitted JS
 *    (transform plugins already applied), mapped by the project's `rootDir`.
 * 2. Any other raw `.ts` dependency (a published or workspace package that ships
 *    source) → build its own owning `tsconfig.json` once via `runBuild` and
 *    serve the emit. A real build (not a type-strip) is required because Node's
 *    type-stripping cannot do cross-file type-only elision — e.g. a
 *    value-shaped import of a type+namespace merge survives stripping and
 *    dangles at runtime.
 * 3. No owning tsconfig → transform the lone file by the format it resolves to: a
 *    CommonJS-classified file (`.cts`, or a `.ts` in a package without `type:
 *    "module"`) is lowered to CommonJS through a tsgo single-file emit so its
 *    `export` syntax becomes `module.exports`; any other (ESM) file keeps the
 *    fast in-process `mode: "transform"` type-strip.
 *
 * The hooks are synchronous and run on the main thread (not a loader worker):
 * that is what lets a CommonJS `require("./x")` chain reach them and what makes
 * `require.resolve(..., { paths })` inside `runBuild`'s plugin loader behave.
 */

/** Source/JS extensions probed when an extensionless relative import fails. */
const RESOLVABLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
] as const;

/** TypeScript source extensions these hooks compile. */
const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;

interface ResolveContext {
  readonly parentURL?: string;
  readonly conditions?: string[];
  readonly importAttributes?: Record<string, string | undefined>;
}

interface ResolveResult {
  url: string;
  format?: string | null;
  shortCircuit?: boolean;
}

interface LoadContext {
  readonly format?: string | null;
  readonly conditions?: string[];
  readonly importAttributes?: Record<string, string | undefined>;
}

interface LoadResult {
  format: string | null | undefined;
  source?: string | ArrayBuffer | NodeJS.TypedArray;
  shortCircuit?: boolean;
}

interface ServedSource {
  source: string;
  moduleOption?: string;
  emittedFile?: string;
  sourceFile?: string;
}

type NextResolve = (
  specifier: string,
  context: ResolveContext,
) => ResolveResult;
type NextLoad = (url: string, context: LoadContext) => LoadResult;

/**
 * Runtime manifest written by `runTtsx` (the parent) and read once here. It
 * describes the already-built entry project so the hooks can serve its emit.
 */
interface RuntimeManifest {
  /** Project root of the entry's owning tsconfig. */
  projectRoot: string;
  /** Source-tree root the emit mirrors (tsgo strips this prefix). */
  rootDir: string;
  /** Directory holding the entry project's emitted JavaScript. */
  emitDir: string;
  /** Emitted file list from the entry build, for source→output matching. */
  emittedFiles?: readonly string[];
  /** The entry tsconfig's `module` option, deciding emit CJS/ESM per file. */
  moduleOption?: string;
  /** Root directory for per-dependency build output. */
  depCacheDir: string;
}

let manifestCache: RuntimeManifest | null | undefined;

function manifest(): RuntimeManifest | null {
  if (manifestCache !== undefined) {
    return manifestCache;
  }
  const file = process.env.TTSX_RUNTIME_MANIFEST;
  if (file === undefined || file.length === 0) {
    manifestCache = null;
    return manifestCache;
  }
  try {
    manifestCache = JSON.parse(
      fs.readFileSync(file, "utf8"),
    ) as RuntimeManifest;
  } catch {
    manifestCache = null;
  }
  return manifestCache;
}

let installed = false;

/**
 * Install the source-loading hooks on the current (main) thread. Idempotent:
 * the bootstrap installs them for the entry process, and `NODE_OPTIONS`
 * re-imports the installer in every child process the program spawns — both may
 * run in the same process.
 *
 * Two hooks are needed, because `module.registerHooks` does not intercept a
 * `require()` made from inside a CommonJS module that was itself reached
 * through an ESM `import` (the interop translator loads it on the raw CJS
 * path). The ESM graph goes through `registerHooks`; the CommonJS `require`
 * graph goes through `Module._extensions` — the canonical loader extension
 * point `ts-node`/`tsx` use for the same reason.
 */
export function installRuntimeHooks(): void {
  if (installed) {
    return;
  }
  installed = true;
  registerHooks({ load, resolve });
  installCommonJsHook();
}

/**
 * Register a CommonJS `require` handler for each TypeScript source extension so
 * a `require("./x")` chain compiles `.ts` the same way the ESM `load` hook
 * does.
 */
function installCommonJsHook(): void {
  const extensions = (
    Module as unknown as {
      _extensions: Record<
        string,
        (
          module: { _compile(source: string, filename: string): void },
          filename: string,
        ) => void
      >;
    }
  )._extensions;
  const compile = (
    module: { _compile(source: string, filename: string): void },
    filename: string,
  ): void => {
    module._compile(resolveServedSource(filename).source, filename);
  };
  for (const extension of [".ts", ".tsx", ".cts"]) {
    extensions[extension] = compile;
  }
}

/**
 * The module format of the entry source file, derived from the entry project's
 * `module` option (via the runtime manifest) the same way the served files are
 * classified. The bootstrap uses it to load the entry through a CommonJS
 * `require` or an ESM `import`.
 */
export function entryModuleFormat(entryFile: string): "module" | "commonjs" {
  return moduleFormat(entryFile, manifest()?.moduleOption) === "module"
    ? "module"
    : "commonjs";
}

/**
 * Rescue an extensionless or directory relative specifier that Node's resolver
 * rejected. Only runs after `nextResolve` throws, so a successful resolution is
 * never perturbed; a genuinely missing module finds no candidate and the
 * original error is rethrown, preserving `ERR_MODULE_NOT_FOUND`.
 */
function resolve(
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolve,
): ResolveResult {
  try {
    return rememberCommonJsNamedInterop(
      nextResolve(specifier, context),
      context,
    );
  } catch (error) {
    const rescued = probeRescuableSpecifier(specifier, context.parentURL);
    if (rescued === null) {
      throw error;
    }
    return rememberCommonJsNamedInterop(
      { shortCircuit: true, url: rescued },
      context,
    );
  }
}

/** Cache of built projects keyed by owning tsconfig path. */
interface BuiltProject {
  emitDir: string;
  rootDir: string;
  emittedFiles?: readonly string[];
  moduleOption?: string;
}
const builtProjects = new Map<string, BuiltProject>();

/** File URLs whose CommonJS source was reached from an ESM parent import. */
const commonJsNamedInteropUrls = new Set<string>();
const commonJsNameScanSources = new Map<string, string | null>();

function load(
  url: string,
  context: LoadContext,
  nextLoad: NextLoad,
): LoadResult {
  if (!url.startsWith("file:")) {
    return nextLoad(url, context);
  }
  const filename = fileURLToPath(url);
  if (!isTypeScriptSource(filename)) {
    return nextLoad(url, context);
  }
  const { format, source } = resolveRuntimeSource(filename, url);
  return {
    format,
    shortCircuit: true,
    source,
  };
}

function resolveRuntimeSource(
  filename: string,
  url: string = pathToFileURL(filename).href,
): { format: string; source: string } {
  const served = resolveServedSource(filename, url);
  const format = moduleFormat(filename, served.moduleOption);
  return {
    format,
    source:
      format === "commonjs" && commonJsNamedInteropUrls.has(url)
        ? exposeCommonJsStarExports(
            served.source,
            served.emittedFile,
            served.sourceFile,
          )
        : served.source,
  };
}

function rememberCommonJsNamedInterop(
  result: ResolveResult,
  context: ResolveContext,
): ResolveResult {
  if (shouldExposeCommonJsNamedExports(result.url, context.parentURL)) {
    commonJsNamedInteropUrls.add(result.url);
  }
  return result;
}

function shouldExposeCommonJsNamedExports(
  url: string,
  parentURL: string | undefined,
): boolean {
  if (
    parentURL === undefined ||
    !url.startsWith("file:") ||
    !parentURL.startsWith("file:")
  ) {
    return false;
  }
  const parentFile = fileURLToPath(parentURL);
  if (
    moduleFormat(parentFile, moduleOptionForSource(parentFile)) !== "module"
  ) {
    return false;
  }
  const filename = fileURLToPath(url);
  return (
    isTypeScriptSource(filename) &&
    moduleFormat(filename, moduleOptionForSource(filename)) === "commonjs"
  );
}

function moduleOptionForSource(filename: string): string | undefined {
  if (!isTypeScriptSource(filename)) {
    return undefined;
  }
  const real = realPath(filename);
  const m = manifest();
  if (m !== null && isWithin(real, m.rootDir)) {
    return m.moduleOption;
  }
  const tsconfig = nearestTsconfig(real);
  if (tsconfig === null) {
    return undefined;
  }
  if (moduleOptionCache.has(tsconfig)) {
    return moduleOptionCache.get(tsconfig);
  }
  let moduleOption: string | undefined;
  try {
    const project = readProjectConfig({
      cwd: path.dirname(tsconfig),
      tsconfig,
    });
    moduleOption =
      typeof project.compilerOptions.module === "string"
        ? project.compilerOptions.module
        : undefined;
  } catch {
    moduleOption = undefined;
  }
  moduleOptionCache.set(tsconfig, moduleOption);
  return moduleOption;
}

/**
 * Resolve the JavaScript to run for a TypeScript source file, in priority
 * order: the entry project's pre-built emit (transform plugins applied), a
 * built raw `.ts` dependency, or — when no tsconfig owns it — a `mode:
 * "transform"` type-strip. Shared by the ESM `load` hook and the CommonJS
 * `require` handler.
 */
function resolveServedSource(
  filename: string,
  url: string = pathToFileURL(filename).href,
): ServedSource {
  const real = realPath(filename);
  const served = serveEntryEmit(real);
  if (served !== null) {
    return { moduleOption: manifest()?.moduleOption, ...served };
  }
  const built = serveDependencyEmit(real);
  if (built !== null) {
    return built;
  }
  return {
    moduleOption: undefined,
    sourceFile: filename,
    source: transformOrphanSource(filename, url),
  };
}

/**
 * Transform a TypeScript source file that no tsconfig owns (a published or
 * vendored package that ships raw `.ts`/`.cts`/`.mts` straight under
 * `node_modules`), choosing the lowering by the format the file resolves to.
 *
 * Node's in-process `stripTypeScriptTypes` only erases type syntax; it never
 * rewrites ECMAScript `import`/`export` into CommonJS. That is correct for a
 * file Node will load as ESM, but wrong for one classified CommonJS — a `.cts`,
 * or a `.ts` in a package without `type: "module"` — when the author wrote it
 * with module syntax (`export const`, `export namespace`, `export function`).
 * Stripping leaves the `export` in place and Node's CommonJS loader dies with
 * `SyntaxError: Unexpected token 'export'`. So a CommonJS-format orphan is
 * lowered through a real tsgo `--module commonjs` single-file emit (which also
 * handles `export =`), exactly the format decision tsgo would have made for an
 * owning project; an ESM-format orphan keeps the fast in-process strip.
 */
function transformOrphanSource(filename: string, url: string): string {
  if (moduleFormat(filename, undefined) === "commonjs") {
    const lowered = emitOrphanAsCommonJs(filename);
    if (lowered !== null) {
      return lowered;
    }
  }
  return stripTypeScriptTypes(fs.readFileSync(filename, "utf8"), {
    mode: "transform",
    sourceUrl: url,
  });
}

/**
 * Lower a single CommonJS-format source file to CommonJS JavaScript by running
 * tsgo on the lone file with `--module commonjs`. Emit-only, no diagnostic gate
 * (the entry project's up-front check is the type gate), matching
 * `buildDependency`. Returns `null` when tsgo is unavailable or produced no
 * output, so the caller can fall back to the in-process strip.
 */
function emitOrphanAsCommonJs(filename: string): string | null {
  let tsgo: string;
  try {
    tsgo = resolveTsgo({ cwd: path.dirname(filename) }).binary;
  } catch {
    return null;
  }
  // Content-hash cache: a CJS-format orphan ('s tsgo single-file emit) is lowered
  // once and reused by every other process in the run, and across runs. Without
  // it a program that fans out into many processes (the automated test corpus
  // imports the same vendored `.ts` deps from thousands of generated files) would
  // re-spawn tsgo per file per process and crawl.
  const cacheFile = orphanCacheFile(filename, tsgo);
  if (cacheFile !== null) {
    const hit = readFileOrNull(cacheFile);
    if (hit !== null) {
      return hit;
    }
  }
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-orphan-"));
  try {
    const res = spawnNative(
      tsgo,
      [
        filename,
        // The file is named on the command line, so any tsconfig tsgo would
        // discover by walking up (the consumer's own) must be ignored — both
        // because it is not this file's project and because tsgo errors out
        // ("tsconfig.json is present but will not be loaded") otherwise.
        "--ignoreConfig",
        "--module",
        "commonjs",
        "--target",
        "es2022",
        // This is an emit-only lowering: the entry project's up-front build is
        // the type gate, so the single-file pass does not need to type-check.
        // Skipping the check (and the lib check it implies) cuts the per-file
        // cost several-fold, which matters when a program generates and imports
        // thousands of raw `.ts` files at runtime (a fanned-out test corpus) and
        // each one would otherwise pay a full single-file check.
        "--noCheck",
        "--skipLibCheck",
        "--outDir",
        outDir,
        "--listEmittedFiles",
      ],
      { cwd: path.dirname(filename), encoding: "utf8" },
    );
    const emitted = parseFirstEmittedFile(outputText(res.stdout));
    const lowered = emitted === null ? null : readFileOrNull(emitted);
    if (lowered !== null && cacheFile !== null) {
      writeOrphanCache(cacheFile, lowered);
    }
    return lowered;
  } catch {
    return null;
  } finally {
    fs.rmSync(outDir, { force: true, recursive: true });
  }
}

/**
 * Emit a source file only for CommonJS export-name discovery.
 *
 * This intentionally does not read or write the runtime orphan cache. Name
 * discovery may inspect a source dependency without executing it, so sharing
 * that output with the runtime fallback would let a speculative scan affect a
 * later load path.
 */
function emitCommonJsForNameScan(filename: string): string | null {
  const real = realPath(filename);
  const cached = commonJsNameScanSources.get(real);
  if (cached !== undefined) {
    return cached;
  }
  let tsgo: string;
  try {
    tsgo = resolveTsgo({ cwd: path.dirname(real) }).binary;
  } catch {
    commonJsNameScanSources.set(real, null);
    return null;
  }
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-export-scan-"));
  try {
    const res = spawnNative(
      tsgo,
      [
        real,
        "--ignoreConfig",
        "--module",
        "commonjs",
        "--target",
        "es2022",
        "--noCheck",
        "--skipLibCheck",
        "--outDir",
        outDir,
        "--listEmittedFiles",
      ],
      { cwd: path.dirname(real), encoding: "utf8" },
    );
    const emitted = pickEmittedJavaScript(
      real,
      parseEmittedFiles(outputText(res.stdout)),
    );
    const lowered = emitted === null ? null : readFileOrNull(emitted);
    commonJsNameScanSources.set(real, lowered);
    return lowered;
  } catch {
    commonJsNameScanSources.set(real, null);
    return null;
  } finally {
    fs.rmSync(outDir, { force: true, recursive: true });
  }
}

/**
 * Cache root for lowered orphan sources, shared per run (and across runs when
 * `TTSC_CACHE_DIR` points at a persisted directory).
 */
function orphanCacheRoot(): string {
  const base =
    process.env.TTSC_CACHE_DIR && process.env.TTSC_CACHE_DIR.length !== 0
      ? process.env.TTSC_CACHE_DIR
      : path.join(os.tmpdir(), "ttsc-orphan");
  return path.join(base, "ttsx-orphan-cjs");
}

/**
 * Content-addressed cache path for one orphan file's CommonJS lowering, keyed
 * by source bytes and the tsgo binary so a tsgo bump invalidates it. `null`
 * when the source cannot be read.
 */
function orphanCacheFile(filename: string, tsgo: string): string | null {
  let source: Buffer;
  try {
    source = fs.readFileSync(filename);
  } catch {
    return null;
  }
  const key = crypto
    .createHash("sha256")
    .update(tsgo)
    .update("\0")
    .update(source)
    .digest("hex")
    .slice(0, 32);
  return path.join(orphanCacheRoot(), `${key}.js`);
}

/**
 * Write the lowered source to its cache path atomically (temp + rename), so a
 * concurrent reader never sees a half-written file. Best-effort: a failure just
 * means the next process re-lowers.
 */
function writeOrphanCache(cacheFile: string, lowered: string): void {
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    const tmp = `${cacheFile}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, lowered);
    fs.renameSync(tmp, cacheFile);
  } catch {
    // ignore — caching is an optimization, correctness does not depend on it
  }
}

/** First `TSFILE:` path tsgo printed under `--listEmittedFiles`, or `null`. */
function parseFirstEmittedFile(stdout: string): string | null {
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^TSFILE:\s*(.+)$/);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/** `TSFILE:` paths tsgo printed under `--listEmittedFiles`. */
function parseEmittedFiles(stdout: string): string[] {
  const files: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^TSFILE:\s*(.+)$/);
    if (match?.[1]) {
      files.push(match[1].trim());
    }
  }
  return files;
}

/** Pick the emitted JavaScript corresponding to the source file requested. */
function pickEmittedJavaScript(
  filename: string,
  emittedFiles: readonly string[],
): string | null {
  const stem = path
    .basename(filename)
    .replace(/\.[cm]?tsx?$/i, "")
    .toLowerCase();
  const candidates = emittedFiles.filter((file) => {
    const parsed = path.parse(file);
    return (
      parsed.name.toLowerCase() === stem && /\.(?:[cm]?js)$/i.test(parsed.base)
    );
  });
  if (candidates.length === 1) {
    return candidates[0]!;
  }
  return emittedFiles.find((file) => /\.(?:[cm]?js)$/i.test(file)) ?? null;
}

/**
 * Make TypeScript-Go's CommonJS `export *` output visible to Node's
 * ESM-from-CJS named export scanner.
 *
 * Tsgo lowers star re-exports to `__exportStar(require("./x"), exports)`.
 * Runtime CommonJS consumers see the getters that helper installs, but Node's
 * ESM linker only exposes named imports it can statically identify from
 * `exports.name = ...` assignments. For relative star re-exports whose emitted
 * target is available, replace the helper call with explicit configurable
 * export placeholders followed by the same `__createBinding` getter install.
 */
function exposeCommonJsStarExports(
  source: string,
  emittedFile: string | undefined,
  sourceFile: string | undefined,
): string {
  if (!source.includes("__exportStar(")) {
    return source;
  }
  const reserved = collectStaticCommonJsExportNames(source);
  let index = 0;
  return source.replace(
    /^(\s*)__exportStar\(\s*require\((["'])([^"']+)\2\)\s*,\s*exports\s*\);/gm,
    (statement: string, indent: string, _quote: string, specifier: string) => {
      const names = [
        ...collectStarExportNames(emittedFile, sourceFile, specifier),
      ].filter(
        (name) =>
          name !== "default" &&
          name !== "__esModule" &&
          isIdentifierName(name) &&
          !reserved.has(name),
      );
      if (names.length === 0) {
        return statement;
      }
      for (const name of names) {
        reserved.add(name);
      }
      const receiver = `__ttsx_export_star_${index++}`;
      return [
        ...names.map((name) => `${indent}exports.${name} = void 0;`),
        `${indent}var ${receiver} = require(${JSON.stringify(specifier)});`,
        ...names.map(
          (name) =>
            `${indent}__createBinding(exports, ${receiver}, ${JSON.stringify(name)});`,
        ),
      ].join("\n");
    },
  );
}

function collectStarExportNames(
  emittedFile: string | undefined,
  sourceFile: string | undefined,
  specifier: string,
): Set<string> {
  if (emittedFile !== undefined) {
    const emittedTarget = resolveEmittedRequire(emittedFile, specifier);
    if (emittedTarget !== null) {
      return collectCommonJsExportNames(emittedTarget, new Set());
    }
  }
  if (sourceFile !== undefined) {
    const sourceTarget = resolveSourceSpecifier(sourceFile, specifier);
    if (sourceTarget !== null) {
      return collectSourceCommonJsExportNames(sourceTarget, new Set());
    }
  }
  return new Set();
}

function collectCommonJsExportNames(
  emittedFile: string,
  seen: Set<string>,
): Set<string> {
  const real = realPath(emittedFile);
  if (seen.has(real)) {
    return new Set();
  }
  seen.add(real);
  const source = readFileOrNull(real);
  if (source === null) {
    return new Set();
  }
  const names = collectStaticCommonJsExportNames(source);
  for (const specifier of collectExportStarSpecifiers(source)) {
    const target = resolveEmittedRequire(real, specifier);
    if (target === null) {
      continue;
    }
    for (const name of collectCommonJsExportNames(target, seen)) {
      if (name !== "default" && name !== "__esModule" && !names.has(name)) {
        names.add(name);
      }
    }
  }
  return names;
}

function collectStaticCommonJsExportNames(source: string): Set<string> {
  const names = new Set<string>();
  const pattern =
    /(?:^|[^\w$])(?:exports|module\.exports)\.([A-Za-z_$][\w$]*)\s*=/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    names.add(match[1]!);
  }
  return names;
}

function collectSourceCommonJsExportNames(
  sourceFile: string,
  seen: Set<string>,
): Set<string> {
  const real = realPath(sourceFile);
  if (seen.has(real)) {
    return new Set();
  }
  seen.add(real);
  const source = emitCommonJsForNameScan(real);
  if (source === null) {
    return new Set();
  }
  const names = collectStaticCommonJsExportNames(source);
  for (const specifier of collectExportStarSpecifiers(source)) {
    const target = resolveSourceSpecifier(real, specifier);
    if (target === null) {
      continue;
    }
    for (const name of collectSourceCommonJsExportNames(target, seen)) {
      if (name !== "default" && name !== "__esModule" && !names.has(name)) {
        names.add(name);
      }
    }
  }
  return names;
}

function collectExportStarSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const pattern =
    /^(\s*)__exportStar\(\s*require\((["'])([^"']+)\2\)\s*,\s*exports\s*\);/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    specifiers.push(match[3]!);
  }
  return specifiers;
}

function resolveEmittedRequire(
  emittedFile: string,
  specifier: string,
): string | null {
  if (!isRelativeSpecifier(specifier)) {
    return null;
  }
  const base = path.resolve(path.dirname(emittedFile), specifier);
  if (path.extname(base).length !== 0) {
    return isFile(base) ? base : null;
  }
  for (const extension of [".js", ".cjs", ".mjs"] as const) {
    const candidate = base + extension;
    if (isFile(candidate)) {
      return candidate;
    }
  }
  for (const extension of [".js", ".cjs", ".mjs"] as const) {
    const candidate = path.join(base, `index${extension}`);
    if (isFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveSourceSpecifier(
  sourceFile: string,
  specifier: string,
): string | null {
  if (!isRelativeSpecifier(specifier)) {
    return null;
  }
  const base = path.resolve(path.dirname(sourceFile), specifier);
  if (path.extname(base).length !== 0) {
    return isFile(base) ? base : null;
  }
  for (const extension of TYPESCRIPT_EXTENSIONS) {
    const candidate = base + extension;
    if (isFile(candidate)) {
      return candidate;
    }
  }
  for (const extension of TYPESCRIPT_EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`);
    if (isFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

function isIdentifierName(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

/**
 * Serve the entry project's pre-built JavaScript for a source file the build
 * emitted, or `null` when the file is outside the build or its emit is
 * missing.
 *
 * The bound is the project's `rootDir` (the source root the emit mirrors), not
 * its tsconfig directory: a project can pull in a file from elsewhere via
 * `files` with a wider `rootDir` (e.g. the lint config loader compiles a
 * `*.config.ts` from any directory under `rootDir: "/"`). Anything outside
 * `rootDir` cannot have a mirrored emit, so it falls through to the dependency
 * paths.
 */
function serveEntryEmit(real: string): ServedSource | null {
  const m = manifest();
  if (m === null) {
    return null;
  }
  if (!isWithin(real, m.rootDir)) {
    return null;
  }
  const emitted = resolveEmittedJavaScript({
    emittedFiles: m.emittedFiles,
    outDir: m.emitDir,
    projectRoot: m.rootDir,
    sourceFile: real,
  });
  if (emitted === null) {
    return null;
  }
  const source = readFileOrNull(emitted);
  return source === null
    ? null
    : { emittedFile: emitted, source, sourceFile: real };
}

/**
 * True when `real` is `directory` itself or sits beneath it. Handles a root
 * `directory` (`/`, `C:\`): naively appending a separator would yield `//`,
 * which no path starts with, so a root `rootDir` project would serve nothing.
 * Both sides are normalized to native separators first: a manifest `rootDir`
 * arrives slash-normalized from the synthesized tsconfig (`C:/` on Windows)
 * while `real` paths are native, and a raw prefix comparison across the two
 * forms silently never matches. Windows paths also compare case-insensitively
 * (a lowercase `TEMP` yields a `c:`-rooted `rootDir` for the same volume the
 * real paths spell `C:`). Exported for direct exercise by the ttsx e2e suite —
 * spawned runs cannot pin the Windows normalization branches on CI.
 */
export function isWithin(real: string, directory: string): boolean {
  const fold = (value: string): string =>
    process.platform === "win32"
      ? path.normalize(value).toLowerCase()
      : path.normalize(value);
  const target = fold(real);
  const dir = fold(directory);
  if (target === dir) {
    return true;
  }
  const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
  return target.startsWith(prefix);
}

/**
 * Build the project that owns `real` (nearest `tsconfig.json` above its real
 * path) and return its emitted JavaScript, or `null` when no tsconfig owns it
 * or the project does not emit it. The build honours the dependency's own
 * tsconfig (transform plugins included), so a source-shipping package that
 * needs a transform behaves correctly at runtime.
 */
function serveDependencyEmit(real: string): ServedSource | null {
  const tsconfig = nearestTsconfig(real);
  if (tsconfig === null) {
    return null;
  }
  let built: BuiltProject;
  try {
    built = ensureProjectBuilt(tsconfig);
  } catch {
    // The owning project produced no emit at all; fall back to type-stripping
    // this single file rather than failing the whole run.
    return null;
  }
  const served = serveBuiltDependency(built, real);
  if (served !== null) {
    return served;
  }
  return null;
}

function serveBuiltDependency(
  built: BuiltProject,
  real: string,
): ServedSource | null {
  const emitted = resolveEmittedJavaScript({
    emittedFiles: built.emittedFiles,
    outDir: built.emitDir,
    projectRoot: built.rootDir,
    sourceFile: real,
  });
  if (emitted === null) {
    return null;
  }
  const source = readFileOrNull(emitted);
  return source === null
    ? null
    : {
        emittedFile: emitted,
        moduleOption: built.moduleOption,
        source,
        sourceFile: real,
      };
}

/** On-disk completion marker for a built dependency, shared across processes. */
interface DependencyCacheMeta {
  rootDir: string;
  moduleOption?: string;
}

/**
 * Build the project that owns a dependency once per run and share the result
 * across every process the program spawns.
 *
 * A program (a benchmark, a worker pool) can fan out into many child processes,
 * each of which inherits the runtime manifest and would otherwise rebuild every
 * dependency from scratch — and worse, several at once into the same directory,
 * corrupting each other. So the build output is content-keyed under the shared
 * per-run cache: a finished build leaves a meta marker that any later process
 * (or a second import in this one) reuses, and concurrent first-builders are
 * serialised by an atomic lock directory.
 */
function ensureProjectBuilt(tsconfig: string): BuiltProject {
  const cached = builtProjects.get(tsconfig);
  if (cached !== undefined) {
    return cached;
  }
  const { emitDir, lockDir, metaPath, root } = dependencyCachePaths(tsconfig);

  const reuse = readDependencyCache(emitDir, metaPath);
  if (reuse !== null) {
    builtProjects.set(tsconfig, reuse);
    return reuse;
  }

  fs.mkdirSync(root, { recursive: true });
  const built = withBuildLock(lockDir, metaPath, emitDir, () =>
    buildDependency(tsconfig, emitDir, metaPath),
  );
  builtProjects.set(tsconfig, built);
  return built;
}

interface DependencyCachePaths {
  emitDir: string;
  lockDir: string;
  metaPath: string;
  root: string;
}

function dependencyCachePaths(tsconfig: string): DependencyCachePaths {
  const key = crypto
    .createHash("sha256")
    .update(tsconfig)
    .digest("hex")
    .slice(0, 16);
  const root = dependencyCacheRoot();
  return {
    emitDir: path.join(root, key),
    lockDir: path.join(root, `${key}.lock`),
    metaPath: path.join(root, `${key}.json`),
    root,
  };
}

/** Reuse a dependency another process (or an earlier import) already built. */
function readDependencyCache(
  emitDir: string,
  metaPath: string,
): BuiltProject | null {
  let meta: DependencyCacheMeta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as DependencyCacheMeta;
  } catch {
    return null;
  }
  if (!emittedAnything(emitDir)) {
    return null;
  }
  return {
    emitDir,
    emittedFiles: undefined,
    moduleOption: meta.moduleOption,
    rootDir: meta.rootDir,
  };
}

/**
 * Run `build` while holding an exclusive lock for this dependency, re-checking
 * the cache once the lock is held (a concurrent builder may have just
 * finished). A waiter polls for the winner's meta marker, and steals an
 * abandoned lock (a builder that crashed) after a generous timeout so the run
 * never wedges.
 */
function withBuildLock(
  lockDir: string,
  metaPath: string,
  emitDir: string,
  build: () => BuiltProject,
): BuiltProject {
  const stealAfterMs = 600_000;
  for (;;) {
    try {
      fs.mkdirSync(lockDir);
    } catch {
      const waited = waitForDependencyCache(emitDir, metaPath, stealAfterMs);
      if (waited !== null) {
        return waited;
      }
      fs.rmSync(lockDir, { force: true, recursive: true });
      continue;
    }
    try {
      const reuse = readDependencyCache(emitDir, metaPath);
      return reuse ?? build();
    } finally {
      fs.rmSync(lockDir, { force: true, recursive: true });
    }
  }
}

/** Poll for a concurrent builder's completion, up to `timeoutMs`. */
function waitForDependencyCache(
  emitDir: string,
  metaPath: string,
  timeoutMs: number,
): BuiltProject | null {
  const startedAt = Date.now();
  for (;;) {
    const reuse = readDependencyCache(emitDir, metaPath);
    if (reuse !== null) {
      return reuse;
    }
    if (Date.now() - startedAt > timeoutMs) {
      return null;
    }
    sleepSync(50);
  }
}

/** Block the current (synchronous) thread for `ms` without busy-spinning. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Compile a dependency project to `emitDir` and write its completion marker. */
function buildDependency(
  tsconfig: string,
  emitDir: string,
  metaPath: string,
): BuiltProject {
  const project = readProjectConfig({ cwd: path.dirname(tsconfig), tsconfig });
  fs.rmSync(emitDir, { force: true, recursive: true });
  const result = runBuild({
    cwd: project.root,
    emit: true,
    forceListEmittedFiles: true,
    outDir: emitDir,
    // Honour the dependency's own transform plugins: a source-shipping package
    // can itself depend on a transform (e.g. a fixture whose values are built
    // with `typia.createRandom`), and its runtime behaviour is wrong without it.
    // `runBuild` runs on this main thread, so its plugin resolution works the
    // same as the entry build's. The exception is loading a plugin descriptor
    // (`TTSC_PLUGIN_DESCRIPTOR_LOAD`): there the descriptor's own — possibly
    // self-hosting — transform must NOT run, or it re-enters plugin loading and
    // deadlocks, so every dependency in that graph builds with plugins off.
    plugins:
      process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1" ? false : undefined,
    quiet: true,
    // Emit only: the entry project's up-front check is the type gate. A
    // dependency build pulls its own transitive sources into the program and
    // would otherwise fail on type diagnostics that belong to those packages
    // under their own (laxer) config — e.g. unused-type-parameter warnings in a
    // transitively imported library. We still want the type-aware emit (for
    // type-only elision), just not the error gate.
    skipDiagnosticsCheck: true,
    tsconfig,
  });
  // Success is "the project wrote JavaScript", not "the build reported a file
  // list": a native transform host (typia, @ttsc/banner, …) emits without
  // printing the `--listEmittedFiles` lines, so `result.emittedFiles` is empty
  // even on a clean build. A genuinely empty output directory is the real
  // failure; the caller then falls back to type-stripping the one file.
  if (!emittedAnything(emitDir)) {
    throw new Error(
      [
        `ttsx: dependency build produced no output for ${tsconfig}`,
        result.stderr || result.stdout,
      ]
        .filter((line) => line.trim().length !== 0)
        .join("\n"),
    );
  }
  const rootDir =
    typeof project.compilerOptions.rootDir === "string"
      ? project.compilerOptions.rootDir
      : project.root;
  const moduleOption =
    typeof project.compilerOptions.module === "string"
      ? project.compilerOptions.module
      : undefined;
  writeDependencyMeta(metaPath, { moduleOption, rootDir });
  return { emitDir, emittedFiles: undefined, moduleOption, rootDir };
}

function writeDependencyMeta(
  metaPath: string,
  meta: DependencyCacheMeta,
): void {
  fs.writeFileSync(metaPath, JSON.stringify(meta), "utf8");
}

function dependencyCacheRoot(): string {
  const m = manifest();
  return m !== null && m.depCacheDir.length !== 0
    ? m.depCacheDir
    : path.join(os.tmpdir(), "ttsx-dep");
}

/** Owning-tsconfig cache keyed by directory, mirroring `packageTypeCache`. */
const tsconfigCache = new Map<string, string | null>();
const moduleOptionCache = new Map<string, string | undefined>();

/**
 * The nearest `tsconfig.json` at or above `file`'s directory, or `null`. The
 * walk stops at a `node_modules` boundary: a tsconfig above `node_modules`
 * belongs to the consumer, not to the published dependency inside it, so a
 * dependency that ships no tsconfig of its own has no owning project and is
 * type-stripped instead. A pnpm-symlinked workspace package is unaffected
 * because `file` is already its real path (outside `node_modules`).
 *
 * The walk is memoised per directory (the whole walked chain shares one
 * answer), so the thousands of files a fanned-out test corpus imports from the
 * same handful of projects do not each re-stat the same parent directories.
 */
function nearestTsconfig(file: string): string | null {
  let directory = path.dirname(file);
  const chain: string[] = [];
  for (;;) {
    const cached = tsconfigCache.get(directory);
    if (cached !== undefined) {
      return rememberTsconfig(chain, cached);
    }
    if (path.basename(directory) === "node_modules") {
      return rememberTsconfig(chain, null);
    }
    chain.push(directory);
    const candidate = path.join(directory, "tsconfig.json");
    if (isFile(candidate)) {
      return rememberTsconfig(chain, candidate);
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return rememberTsconfig(chain, null);
    }
    directory = parent;
  }
}

function rememberTsconfig(
  directories: readonly string[],
  result: string | null,
): string | null {
  for (const directory of directories) {
    tsconfigCache.set(directory, result);
  }
  return result;
}

function readFileOrNull(file: string | null): string | null {
  if (file === null) {
    return null;
  }
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function realPath(target: string): string {
  try {
    return fs.realpathSync(target);
  } catch {
    return target;
  }
}

/**
 * Map the JavaScript extension a relative `specifier` carries to the TypeScript
 * source extensions tsgo would have emitted it from. Running from source, a
 * `"./x.js"` import (whether authored or rewritten from `"./x.ts"` by
 * `--rewriteRelativeImportExtensions`) has no `.js` on disk — only `./x.ts`.
 */
const JS_TO_TS_EXTENSIONS: ReadonlyMap<string, readonly string[]> = new Map([
  [".js", [".ts", ".tsx"]],
  [".jsx", [".tsx"]],
  [".mjs", [".mts"]],
  [".cjs", [".cts"]],
]);

/**
 * Rescue a `specifier` that Node's resolver rejected: map a JavaScript
 * extension back to its TypeScript source, or probe candidate extensions /
 * directory indexes for an extensionless form. Returns a `file:` URL for the
 * first match, or `null` when nothing matches.
 *
 * Handles two shapes:
 *
 * - A relative specifier (`./x`) resolved against a `file:` parent — a normal
 *   `import`/`require` inside a served module;
 * - An already-absolute specifier with no parent — the main entry of a
 *   `child_process.fork(__dirname + "/servant.js")`. fork's main module reaches
 *   the resolve hook as an absolute `.js` path with `parentURL` undefined, and
 *   run-from-source ships only the `.ts`, so without this the child dies with
 *   `Cannot find module servant.js` and a tgrid master waits on it forever.
 */
function probeRescuableSpecifier(
  specifier: string,
  parentURL: string | undefined,
): string | null {
  // A `?query` / `#hash` suffix is part of module identity, not the path; strip
  // it before resolving and re-attach it to the resolved URL so a loader keying
  // on the suffix (and `import.meta.url`) sees it preserved.
  const suffixStart = specifier.search(/[?#]/);
  const suffix = suffixStart === -1 ? "" : specifier.slice(suffixStart);
  const pathname =
    suffixStart === -1 ? specifier : specifier.slice(0, suffixStart);
  let base: string;
  if (isRelativeSpecifier(specifier)) {
    if (parentURL === undefined || !parentURL.startsWith("file:")) {
      return null;
    }
    const parentDir = path.dirname(fileURLToPath(parentURL));
    base = path.resolve(parentDir, pathname);
  } else if (path.isAbsolute(pathname)) {
    base = pathname;
  } else {
    return null;
  }
  const withSuffix = (candidate: string): string =>
    pathToFileURL(candidate).href + suffix;

  const jsExtension = path.extname(base).toLowerCase();
  const tsExtensions = JS_TO_TS_EXTENSIONS.get(jsExtension);
  if (tsExtensions !== undefined) {
    const stem = base.slice(0, base.length - jsExtension.length);
    for (const extension of tsExtensions) {
      const candidate = stem + extension;
      if (isFile(candidate)) {
        return withSuffix(candidate);
      }
    }
    return null;
  }
  if (hasConcreteExtension(pathname)) {
    return null;
  }
  for (const extension of RESOLVABLE_EXTENSIONS) {
    const candidate = base + extension;
    if (isFile(candidate)) {
      return withSuffix(candidate);
    }
  }
  for (const extension of RESOLVABLE_EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`);
    if (isFile(candidate)) {
      return withSuffix(candidate);
    }
  }
  return null;
}

/**
 * Decide the module format the way Node and tsgo do — from configuration, never
 * by sniffing the emitted text. The file extension is authoritative
 * (`.mts`/`.mjs` → module, `.cts`/`.cjs` → commonjs); otherwise the owning
 * tsconfig's `module` option decides: a fixed CommonJS / ES target maps
 * directly, while the `node*`/`preserve` family (and a file with no owning
 * tsconfig) defers to the nearest `package.json` `type`, exactly as tsgo chose
 * when it emitted.
 */
function moduleFormat(
  filename: string,
  moduleOption: string | undefined,
): string {
  if (filename.endsWith(".mts") || filename.endsWith(".mjs")) {
    return "module";
  }
  if (filename.endsWith(".cts") || filename.endsWith(".cjs")) {
    return "commonjs";
  }
  const option = (moduleOption ?? "").toLowerCase();
  if (option === "commonjs" || option === "node10" || option === "none") {
    return "commonjs";
  }
  if (
    option === "" ||
    option === "node16" ||
    option === "node18" ||
    option === "nodenext" ||
    option === "preserve"
  ) {
    return nearestPackageType(filename);
  }
  // Every remaining `module` target (es2015 … esnext, system, amd, umd) emits
  // ECMAScript modules.
  return "module";
}

/** Package-type cache keyed by directory, mirroring Node's own lookup walk. */
const packageTypeCache = new Map<string, "module" | "commonjs">();

function nearestPackageType(filename: string): "module" | "commonjs" {
  let directory = path.dirname(filename);
  const chain: string[] = [];
  while (true) {
    const cached = packageTypeCache.get(directory);
    if (cached !== undefined) {
      return rememberPackageType(chain, cached);
    }
    chain.push(directory);
    const type = readPackageType(directory);
    if (type !== null) {
      return rememberPackageType(chain, type);
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return rememberPackageType(chain, "commonjs");
    }
    directory = parent;
  }
}

function rememberPackageType(
  directories: readonly string[],
  type: "module" | "commonjs",
): "module" | "commonjs" {
  for (const directory of directories) {
    packageTypeCache.set(directory, type);
  }
  return type;
}

/** Read a directory's `package.json` `type`, or `null` when absent/invalid. */
function readPackageType(directory: string): "module" | "commonjs" | null {
  const manifestPath = path.join(directory, "package.json");
  if (!isFile(manifestPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      type?: unknown;
    };
    return parsed.type === "module" ? "module" : "commonjs";
  } catch {
    return "commonjs";
  }
}

function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  );
}

/** True when `specifier` already carries an extension Node can load directly. */
function hasConcreteExtension(specifier: string): boolean {
  return /\.(?:[cm]?jsx?|json|node|[cm]?tsx?)$/i.test(specifier);
}

function isTypeScriptSource(filename: string): boolean {
  return TYPESCRIPT_EXTENSIONS.some((extension) =>
    filename.endsWith(extension),
  );
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/** True when `directory` holds at least one emitted JavaScript file (any depth). */
function emittedAnything(directory: string): boolean {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (emittedAnything(full)) {
        return true;
      }
    } else if (entry.isFile() && /\.(?:[cm]?js)$/i.test(entry.name)) {
      return true;
    }
  }
  return false;
}
