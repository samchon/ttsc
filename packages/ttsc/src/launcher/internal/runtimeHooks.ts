import crypto from "node:crypto";
import fs from "node:fs";
import { Module, registerHooks, stripTypeScriptTypes } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveEmittedJavaScript } from "../../compiler/internal/resolveEmittedJavaScript";
import { runBuild } from "../../compiler/internal/runBuild";

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
 * 3. No owning tsconfig → fall back to a `mode: "transform"` type-strip.
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
    return nextResolve(specifier, context);
  } catch (error) {
    const rescued = probeRelativeSpecifier(specifier, context.parentURL);
    if (rescued === null) {
      throw error;
    }
    return { shortCircuit: true, url: rescued };
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
  const { source, moduleOption } = resolveServedSource(filename, url);
  return {
    format: moduleFormat(filename, moduleOption),
    shortCircuit: true,
    source,
  };
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
): { source: string; moduleOption?: string } {
  const real = realPath(filename);
  const served = serveEntryEmit(real);
  if (served !== null) {
    return { moduleOption: manifest()?.moduleOption, source: served };
  }
  const built = serveDependencyEmit(real);
  if (built !== null) {
    return built;
  }
  return {
    moduleOption: undefined,
    source: stripTypeScriptTypes(fs.readFileSync(filename, "utf8"), {
      mode: "transform",
      sourceUrl: url,
    }),
  };
}

/**
 * Serve the entry project's pre-built JavaScript for a source file under its
 * `rootDir`, or `null` when the file is outside the entry project or its emit
 * is missing.
 */
function serveEntryEmit(real: string): string | null {
  const m = manifest();
  if (m === null) {
    return null;
  }
  if (real !== m.projectRoot && !real.startsWith(m.projectRoot + path.sep)) {
    return null;
  }
  const emitted = resolveEmittedJavaScript({
    emittedFiles: m.emittedFiles,
    outDir: m.emitDir,
    projectRoot: m.rootDir,
    sourceFile: real,
  });
  return readFileOrNull(emitted);
}

/**
 * Build the project that owns `real` (nearest `tsconfig.json` above its real
 * path) and return its emitted JavaScript, or `null` when no tsconfig owns it
 * or the project does not emit it. The build honours the dependency's own
 * tsconfig (transform plugins included), so a source-shipping package that
 * needs a transform behaves correctly at runtime.
 */
function serveDependencyEmit(
  real: string,
): { source: string; moduleOption?: string } | null {
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
  const emitted = resolveEmittedJavaScript({
    emittedFiles: built.emittedFiles,
    outDir: built.emitDir,
    projectRoot: built.rootDir,
    sourceFile: real,
  });
  const source = readFileOrNull(emitted);
  return source === null ? null : { moduleOption: built.moduleOption, source };
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
  const key = crypto
    .createHash("sha256")
    .update(tsconfig)
    .digest("hex")
    .slice(0, 16);
  const root = dependencyCacheRoot();
  const emitDir = path.join(root, key);
  const metaPath = path.join(root, `${key}.json`);
  const lockDir = path.join(root, `${key}.lock`);

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
    // same as the entry build's.
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
  fs.writeFileSync(
    metaPath,
    JSON.stringify({ moduleOption, rootDir } satisfies DependencyCacheMeta),
    "utf8",
  );
  return { emitDir, emittedFiles: undefined, moduleOption, rootDir };
}

function dependencyCacheRoot(): string {
  const m = manifest();
  return m !== null && m.depCacheDir.length !== 0
    ? m.depCacheDir
    : path.join(os.tmpdir(), "ttsx-dep");
}

/**
 * The nearest `tsconfig.json` at or above `file`'s directory, or `null`. The
 * walk stops at a `node_modules` boundary: a tsconfig above `node_modules`
 * belongs to the consumer, not to the published dependency inside it, so a
 * dependency that ships no tsconfig of its own has no owning project and is
 * type-stripped instead. A pnpm-symlinked workspace package is unaffected
 * because `file` is already its real path (outside `node_modules`).
 */
function nearestTsconfig(file: string): string | null {
  let directory = path.dirname(file);
  for (;;) {
    if (path.basename(directory) === "node_modules") {
      return null;
    }
    const candidate = path.join(directory, "tsconfig.json");
    if (isFile(candidate)) {
      return candidate;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return null;
    }
    directory = parent;
  }
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
 * Rescue a relative `specifier` that Node's resolver rejected: map a JavaScript
 * extension back to its TypeScript source, or probe candidate extensions /
 * directory indexes for an extensionless form. Returns a `file:` URL for the
 * first match, or `null` when nothing matches.
 */
function probeRelativeSpecifier(
  specifier: string,
  parentURL: string | undefined,
): string | null {
  if (!isRelativeSpecifier(specifier)) {
    return null;
  }
  if (parentURL === undefined || !parentURL.startsWith("file:")) {
    return null;
  }
  // A `?query` / `#hash` suffix is part of module identity, not the path; strip
  // it before resolving and re-attach it to the resolved URL so a loader keying
  // on the suffix (and `import.meta.url`) sees it preserved.
  const suffixStart = specifier.search(/[?#]/);
  const suffix = suffixStart === -1 ? "" : specifier.slice(suffixStart);
  const pathname =
    suffixStart === -1 ? specifier : specifier.slice(0, suffixStart);
  const parentDir = path.dirname(fileURLToPath(parentURL));
  const base = path.resolve(parentDir, pathname);
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
