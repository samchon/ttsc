import { createHash } from "node:crypto";
import fs from "node:fs";
import Module from "node:module";
import type { LoadHookSync, ResolveHookSync } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveEmittedJavaScript } from "../../compiler/internal/resolveEmittedJavaScript";
import { runBuild } from "../../compiler/internal/runBuild";

/**
 * Node.js module-customization hooks `ttsx` installs (via `registerHooks`) in
 * the child process it spawns. `registerHooks` is synchronous and in-thread, so
 * the hooks cover BOTH `import` and `require` across the whole graph.
 *
 * The runtime never re-transpiles TypeScript and never relocates a module's
 * identity: every `.ts` keeps its own source path as its module URL, and the
 * `load` hook serves the JavaScript tsgo emitted for it as that module's source
 * — the same model `ts-node`/`tsx` use, but the bytes come from a real,
 * type-checked, plugin-applied tsgo build instead of a per-file transpile.
 *
 * Because identity stays at the source, `import.meta.url`, `__dirname`, and
 * relative `fs`/asset reads all point at the real source tree, exactly as if
 * the code had been authored in JavaScript there.
 *
 * - `resolve` keeps a resolved `.ts` URL as-is and maps a sibling specifier the
 *   compiler emitted (`./x.js`, or an extensionless `./x`) back to the source
 *   `.ts`, so resolution lands on real source files.
 * - `load` replaces a `.ts` source's bytes with its compiled JavaScript: the
 *   entry project's own sources come from the up-front compile gate's emit; a
 *   dependency consumed as raw `.ts` is compiled by tsgo through its own
 *   `tsconfig` into a per-package cache. The returned `format` is always plain
 *   `module`/`commonjs`, so Node never runs its native type-stripping (which
 *   bans `.ts` under `node_modules`).
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

/** TypeScript source extensions whose modules are served from tsgo's emit. */
const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;

/**
 * Keep a resolved TypeScript source at its own URL, and rescue a relative
 * specifier the compiler emitted (or an extensionless one) by mapping it back
 * onto the source tree.
 *
 * A successful resolution that lands on a `.ts` is returned with its TypeScript
 * `format` dropped so the `load` hook decides the real module format. A failed
 * resolution is retried against the source tree — `./x.js` → `./x.ts`, an
 * extensionless `./x` → `./x.ts`/directory index — preserving
 * `ERR_MODULE_NOT_FOUND` when nothing matches.
 */
export const resolve: ResolveHookSync = (specifier, context, nextResolve) => {
  let result;
  try {
    result = nextResolve(specifier, context);
  } catch (error) {
    const rescued = rescueSourceSpecifier(specifier, context.parentURL);
    if (rescued === null) {
      throw error;
    }
    result = { shortCircuit: true, url: rescued };
  }
  if (!isTypeScriptUrl(result.url)) {
    return result;
  }
  // Drop any TypeScript `format` the resolver attached (e.g.
  // `module-typescript`): keeping it would make Node run its native
  // type-stripping on a file the `load` hook is about to replace with compiled
  // JavaScript. With it gone, `load` declares the real `module`/`commonjs`.
  const kept = { ...result, shortCircuit: true };
  delete (kept as { format?: unknown }).format;
  return kept;
};

/**
 * Bridge `ttsx`'s source-identity model into the CommonJS loader, which classic
 * `require()` uses directly and the `registerHooks` `resolve`/`load` hooks do
 * NOT reach.
 *
 * - `Module._resolveFilename` is wrapped so a relative `require` the compiler
 *   emitted (`./x`, `./x.js`) that the default resolver misses is mapped onto
 *   the source `.ts`, the same way the ESM `resolve` hook does.
 * - `Module._extensions` for each TypeScript extension compiles the source to its
 *   emitted JavaScript and runs THAT under the original `.ts` filename, so
 *   `__dirname`/`__filename` stay at the source — mirroring the `load` hook.
 */
export function installCommonJsHooks(): void {
  const internal = Module as unknown as NodeCommonJsModule;
  const resolveFilename = internal._resolveFilename;
  internal._resolveFilename = function (request, parent, isMain, options) {
    try {
      return resolveFilename.call(this, request, parent, isMain, options);
    } catch (error) {
      const mapped = sourceTypeScriptForRequest(request, parent);
      if (mapped !== null) {
        return mapped;
      }
      throw error;
    }
  };
  for (const extension of TYPESCRIPT_EXTENSIONS) {
    internal._extensions[extension] = (module, filename) => {
      const compiled = compiledJavaScriptFor(realpathIfExists(filename));
      module._compile(fs.readFileSync(compiled, "utf8"), filename);
    };
  }
}

/** The internal CommonJS-loader surface `ttsx` patches for `require`. */
interface NodeCommonJsModule {
  _resolveFilename(
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ): string;
  _extensions: Record<
    string,
    (
      module: { _compile(content: string, filename: string): unknown },
      filename: string,
    ) => void
  >;
}

/**
 * Map a relative `require` request the default resolver could not find onto the
 * source `.ts` it was compiled from, or `null` when it is non-relative, has no
 * usable parent, or matches nothing on disk.
 */
function sourceTypeScriptForRequest(
  request: string,
  parent: unknown,
): string | null {
  if (typeof request !== "string" || !isRelativeSpecifier(request)) {
    return null;
  }
  const parentFile = (parent as { filename?: unknown } | null)?.filename;
  if (typeof parentFile !== "string") {
    return null;
  }
  const [pathPart] = splitSpecifierSuffix(request);
  const resolved = resolveSourcePathPart(pathPart, path.dirname(parentFile));
  return resolved === null ? null : fileFromFileUrl(resolved);
}

/**
 * Serve a TypeScript source's compiled JavaScript as its module source, keeping
 * the source `.ts` URL as the module's identity. Everything else is left to the
 * default loader.
 */
export const load: LoadHookSync = (url, context, nextLoad) => {
  if (!url.startsWith("file:")) {
    return nextLoad(url, context);
  }
  const file = fileFromFileUrl(url);
  if (!isTypeScriptSource(file)) {
    return nextLoad(url, context);
  }
  const compiled = compiledJavaScriptFor(realpathIfExists(file));
  const source = fs.readFileSync(compiled, "utf8");
  return { format: moduleFormat(file, source), shortCircuit: true, source };
};

/**
 * The compiled JavaScript tsgo emitted for a `.ts` source.
 *
 * The compile gate compiles the entry PROGRAM — the entry's own sources AND any
 * source-consumed workspace dependency pulled into it — with the full program's
 * type context and plugin transforms. Any source the gate emitted is served
 * from there, so a transform that crosses package boundaries (e.g. a schema
 * over a type imported from a workspace package) sees every type, not just the
 * dependency's own narrower program. A source the gate did NOT emit — a
 * published `node_modules` package that ships raw `.ts` — is compiled on its
 * own. Throws a clear diagnostic when neither produces JavaScript for it.
 */
function compiledJavaScriptFor(sourceFile: string): string {
  const entry = entryProject();
  if (entry !== null) {
    // The gate lays a source's emit at `emitDir` + its position relative to the
    // source root. The root is mirrored under `emitDir` so this holds even for a
    // workspace dependency the program pulls in from ABOVE `rootDir` (whose
    // relative path begins with `..`), which `resolveEmittedJavaScript` declines
    // to map for being outside the project.
    const mirrored = withJsExtension(
      path.join(entry.emitDir, path.relative(entry.emitBase, sourceFile)),
    );
    if (isFile(mirrored)) {
      return mirrored;
    }
    if (isInsideDirectory(entry.emitBase, sourceFile)) {
      const emitted = resolveEmittedJavaScript({
        outDir: entry.emitDir,
        projectRoot: entry.emitBase,
        sourceFile,
      });
      if (emitted !== null) {
        return emitted;
      }
      throw new Error(
        `ttsx: ${sourceFile} belongs to the entry project but the compile gate ` +
          `emitted no JavaScript for it (is it included in the project's build?)`,
      );
    }
  }
  const emitted = emittedDependencyFile(sourceFile);
  if (emitted === null) {
    throw new Error(
      `ttsx: ${sourceFile} is not inside any package, so its TypeScript ` +
        `cannot be compiled for execution`,
    );
  }
  return emitted;
}

/** Replace a TypeScript source extension with its JavaScript emit counterpart. */
function withJsExtension(filename: string): string {
  return filename.replace(/\.([cm]?)tsx?$/i, ".$1js");
}

/** The entry project's emit, passed by the launcher; `null` outside `ttsx`. */
interface EntryProject {
  /** Directory the gate's emit is laid out relative to (the project rootDir). */
  readonly emitBase: string;
  /** Directory the gate emitted the entry project's JavaScript into. */
  readonly emitDir: string;
}
let entryProjectCache: EntryProject | null | undefined;
function entryProject(): EntryProject | null {
  if (entryProjectCache === undefined) {
    const emitDir = process.env.TTSC_TTSX_ENTRY_EMIT_DIR;
    const emitBase = process.env.TTSC_TTSX_ENTRY_EMIT_BASE;
    entryProjectCache =
      emitDir && emitBase
        ? { emitBase: realpathIfExists(emitBase), emitDir }
        : null;
  }
  return entryProjectCache;
}

/** A package's tsgo build outputs, keyed by its package root. */
interface BuiltProject {
  /** Per-package cache the package's `.ts` sources are served from. */
  readonly outDir: string;
  /** Directory the emit is laid out relative to (the project's `rootDir`). */
  readonly emitBase: string;
}
const builtProjects = new Map<string, BuiltProject>();

/**
 * Compile the package that owns `sourceFile` with tsgo (once per process,
 * cached) and return the emitted JavaScript for that file, or `null` when no
 * owning package is found.
 *
 * The package is built through its own `tsconfig` when it ships one; otherwise
 * a minimal config rooted at the package is synthesized, so a published package
 * that ships raw `.ts` with no config still compiles through the real
 * compiler.
 */
function emittedDependencyFile(sourceFile: string): string | null {
  const packageRoot = owningPackageRoot(sourceFile);
  if (packageRoot === null) {
    return null;
  }
  let built = builtProjects.get(packageRoot);
  if (built === undefined) {
    built = buildDependencyPackage(packageRoot);
    builtProjects.set(packageRoot, built);
  }
  const emitted = resolveEmittedJavaScript({
    outDir: built.outDir,
    projectRoot: built.emitBase,
    sourceFile,
  });
  if (emitted === null) {
    // The package built, but no emitted `.js` was found for this source — its
    // `tsconfig` may exclude the file, its `rootDir` may not contain it, or the
    // cache may be stale. Surface it (with the cache path to inspect or clear)
    // instead of letting Node fail loading the raw `.ts`.
    throw new Error(
      `ttsx: ${sourceFile} compiled as part of package ${packageRoot}, but no ` +
        `emitted JavaScript was found for it under ${built.outDir} (check the ` +
        `package's tsconfig include/exclude and rootDir, or clear that cache)`,
    );
  }
  return emitted;
}

/** Per-package cache directory holding the package's tsgo emit. */
function dependencyCacheDir(packageRoot: string): string {
  return path.join(packageRoot, "node_modules", ".cache", "ttsc", "ttsx-deps");
}

/** Filename of the freshness stamp written into a completed cache. */
const STAMP_FILE = ".ttsx-stamp.json";
let stagingCounter = 0;

/**
 * Build the package at `packageRoot` with tsgo and return where its emit lives.
 *
 * A full, type-checked build runs only when the per-package cache is stale; a
 * fresh cache (its stamp matches the current ttsc version, tsconfig, and source
 * mtimes) is reused as-is. The build emits into a private staging directory
 * that is promoted into place once complete, so concurrent `ttsx` processes
 * never observe a half-written cache and never corrupt one another's. Throws on
 * a non-zero build — a dependency's own type error must surface, not be
 * skipped.
 */
function buildDependencyPackage(packageRoot: string): BuiltProject {
  const outDir = dependencyCacheDir(packageRoot);
  const project = packageProject(packageRoot);
  const stamp = freshnessStamp(packageRoot, project.tsconfig, project.options);
  if (readStamp(outDir) === stamp) {
    return { emitBase: project.emitBase, outDir };
  }
  const staging = `${outDir}.${process.pid}.${(stagingCounter += 1)}.staging`;
  try {
    fs.rmSync(staging, { force: true, recursive: true });
    const result = runBuild({
      cwd: packageRoot,
      emit: true,
      outDir: staging,
      quiet: true,
      tsconfig: project.tsconfig,
    });
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || "").trim();
      throw new Error(
        `ttsx: failed to compile dependency package ${packageRoot} ` +
          `(tsgo exited with status ${result.status})` +
          (detail ? `\n${detail}` : " (no compiler output)"),
      );
    }
    // tsgo creates `staging` only as a side effect of emitting into it; a build
    // that legitimately emits nothing (e.g. every input is declaration-only)
    // succeeds without creating the directory, so ensure it exists before
    // stamping. The empty cache then promotes normally and the eventual
    // resolve gives the proper "no emitted JavaScript" diagnostic, rather than
    // crashing here with a raw ENOENT on the stamp write.
    fs.mkdirSync(staging, { recursive: true });
    fs.writeFileSync(path.join(staging, STAMP_FILE), stamp, "utf8");
    promoteDirectory(staging, outDir, stamp);
  } finally {
    fs.rmSync(staging, { force: true, recursive: true });
  }
  return { emitBase: project.emitBase, outDir };
}

/**
 * Resolve the tsconfig a package builds through and the directory its emit is
 * laid out relative to. A package's own config (at the package root) is
 * preferred; a package that ships none gets a minimal config synthesized into a
 * stable path beside the cache, with `bundler` resolution so the extensionless
 * relative imports raw sources tend to use still resolve. The synthesized file
 * is rewritten only when its content changes, so its mtime stays a reliable
 * freshness input.
 */
function packageProject(packageRoot: string): {
  tsconfig: string;
  emitBase: string;
  options: unknown;
} {
  const own = ownProjectConfig(packageRoot);
  if (own !== null) {
    return own;
  }
  const root = toPosix(packageRoot);
  const compilerOptions = {
    module: "preserve",
    moduleResolution: "bundler",
    rootDir: root,
    // The entry compile gate already type-checked this dependency in the
    // consuming program; this build only needs runnable emit, so library
    // declaration files are skipped.
    skipLibCheck: true,
    target: "esnext",
  };
  const content = JSON.stringify(
    {
      compilerOptions,
      include: [`${root}/**/*`],
      exclude: [`${root}/node_modules`],
    },
    null,
    2,
  );
  const dir = path.join(packageRoot, "node_modules", ".cache", "ttsc");
  fs.mkdirSync(dir, { recursive: true });
  const tsconfig = path.join(dir, "ttsx-deps.tsconfig.json");
  if (readFileOrNull(tsconfig) !== content) {
    fs.writeFileSync(tsconfig, content, "utf8");
  }
  return { emitBase: packageRoot, options: compilerOptions, tsconfig };
}

/**
 * The package's own `tsconfig` (and its emit base) when one sits at the package
 * root, or `null` when the nearest config belongs to an ancestor — an ancestor
 * config must not be mistaken for the package's own build.
 */
function ownProjectConfig(
  packageRoot: string,
): { tsconfig: string; emitBase: string; options: unknown } | null {
  let project: ReturnType<typeof readProjectConfig>;
  try {
    project = readProjectConfig({ cwd: packageRoot });
  } catch (error) {
    // `readProjectConfig` throws both when no config exists anywhere up the
    // tree (the cue to synthesize one) and when a config that DOES exist is
    // unreadable. A broken config sitting at the package root is a real error
    // to surface, not a reason to silently build under a different, synthesized
    // config. `readProjectConfig` resolves both `tsconfig.json` and
    // `jsconfig.json`, so a broken one of either name is surfaced.
    const rootConfig = ["tsconfig.json", "jsconfig.json"].find((name) =>
      isFile(path.join(packageRoot, name)),
    );
    if (rootConfig !== undefined) {
      throw new Error(
        `ttsx: dependency package ${packageRoot} has an unreadable ` +
          `${rootConfig}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return null;
  }
  if (!samePath(project.root, packageRoot)) {
    return null;
  }
  return {
    emitBase: emitBaseDirectory(project),
    options: project.compilerOptions,
    tsconfig: project.path,
  };
}

/**
 * A string that changes whenever the cache must be rebuilt: the ttsc version
 * (emit logic), the resolved compiler options, the leaf tsconfig's identity and
 * mtime, and the package's full set of `.ts` sources with their mtimes. Hashing
 * the _resolved_ options catches a change in an `extends`-ed base config (a
 * base config lives outside the package and is never enumerated as a source);
 * also hashing the leaf tsconfig's mtime catches a change to a field the
 * resolved options omit — notably `include`/`exclude`/`files`, which change the
 * build's input set. Hashing the whole sorted source set — not just the newest
 * mtime — means a deleted or renamed source invalidates it as well, not only an
 * edited one. A completed cache stores this; a later run reuses it only on an
 * exact match.
 *
 * The source set walks the package's own directory tree. A package whose build
 * reaches `.ts` files OUTSIDE its own root — an `include`/`files` glob pointing
 * at a sibling directory, or an `extends`-base that itself declares `include` —
 * is the one case not covered: a content edit to such an out-of-tree input is
 * not seen here. That layout is an anti-pattern for a consumed package (its
 * sources should live under its own root), so the stamp does not pay to chase
 * it; fully closing it would require stamping the input set tsgo actually
 * reads.
 */
function freshnessStamp(
  packageRoot: string,
  tsconfig: string,
  options: unknown,
): string {
  const digest = createHash("sha1");
  digest.update(JSON.stringify(options ?? {}));
  digest.update(`\0${path.resolve(tsconfig)}\0${statMtimeMs(tsconfig)}`);
  for (const source of typeScriptSources(packageRoot).sort()) {
    digest.update(`\0${source}\0${statMtimeMs(source)}`);
  }
  return JSON.stringify({
    version: ttscVersion(),
    digest: digest.digest("hex"),
  });
}

/** Same filesystem path, case-insensitively on case-insensitive platforms. */
function samePath(a: string, b: string): boolean {
  const ra = path.resolve(a);
  const rb = path.resolve(b);
  return process.platform === "win32"
    ? ra.toLowerCase() === rb.toLowerCase()
    : ra === rb;
}

/** Read a cache's freshness stamp, or `null` when it is absent or unreadable. */
function readStamp(outDir: string): string | null {
  return readFileOrNull(path.join(outDir, STAMP_FILE));
}

/**
 * Move `staging` onto `outDir` as a complete unit. A plain rename wins when
 * `outDir` is absent.
 *
 * When `outDir` already exists, the common case under parallel `ttsx` processes
 * is that a peer promoted the _same_ build first — every process computes an
 * identical `stamp` from identical sources and options — so if the existing
 * cache already carries our stamp we keep it and discard `staging`, never
 * touching the live directory. Only a genuinely stale `outDir` is replaced, and
 * then the old copy is set aside (not deleted up front) and restored if the
 * swap-in fails, so a reader never loses a usable cache.
 */
function promoteDirectory(
  staging: string,
  outDir: string,
  stamp: string,
): void {
  fs.mkdirSync(path.dirname(outDir), { recursive: true });
  try {
    fs.renameSync(staging, outDir);
    return;
  } catch {
    // `outDir` already exists; decide whether it must be replaced.
  }
  if (readStamp(outDir) === stamp) {
    // A peer already promoted our exact build; keep theirs untouched.
    return;
  }
  const retired = `${outDir}.${process.pid}.${(stagingCounter += 1)}.retired`;
  try {
    fs.renameSync(outDir, retired);
  } catch {
    // A peer moved/replaced `outDir` first; leave whatever they put there.
    return;
  }
  try {
    fs.renameSync(staging, outDir);
  } catch {
    // The swap-in failed (e.g. a peer recreated `outDir`). Prefer whatever is
    // now in place; if nothing is, restore the cache we set aside rather than
    // leaving `outDir` missing.
    if (!fs.existsSync(outDir)) {
      try {
        fs.renameSync(retired, outDir);
      } catch {
        // A peer won the slot; nothing left to restore.
      }
    }
  }
  fs.rmSync(retired, { force: true, recursive: true });
}

/**
 * Enumerate the TypeScript source files under `packageRoot`, skipping
 * `node_modules`.
 */
function typeScriptSources(packageRoot: string): string[] {
  const out: string[] = [];
  const stack = [packageRoot];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules") {
        continue;
      }
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile() && isTypeScriptSource(next)) {
        out.push(next);
      }
    }
  }
  return out;
}

let cachedTtscVersion: string | undefined;
function ttscVersion(): string {
  if (cachedTtscVersion === undefined) {
    try {
      const manifest = path.join(__dirname, "..", "..", "..", "package.json");
      cachedTtscVersion = String(
        (JSON.parse(fs.readFileSync(manifest, "utf8")) as { version?: unknown })
          .version ?? "0",
      );
    } catch {
      cachedTtscVersion = "0";
    }
  }
  return cachedTtscVersion;
}

function statMtimeMs(file: string): number {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function readFileOrNull(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/** Normalize a filesystem path to forward slashes for use in tsconfig globs. */
function toPosix(filename: string): string {
  return filename.split(path.sep).join("/");
}

/**
 * The directory tsgo lays its emit out relative to: the project's explicit
 * `rootDir`, or the project root when none is configured.
 * `resolveEmittedJavaScript` mirrors a source's position under this directory
 * into the `outDir`.
 */
function emitBaseDirectory(
  project: ReturnType<typeof readProjectConfig>,
): string {
  const rootDir = project.compilerOptions.rootDir;
  if (typeof rootDir === "string") {
    return path.isAbsolute(rootDir)
      ? rootDir
      : path.resolve(project.root, rootDir);
  }
  return project.root;
}

/**
 * Nearest ancestor directory of `file` (inclusive of its own) holding a
 * `package.json`.
 */
function owningPackageRoot(file: string): string | null {
  let directory = path.dirname(file);
  while (true) {
    if (isFile(path.join(directory, "package.json"))) {
      return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return null;
    }
    directory = parent;
  }
}

/**
 * Rescue a relative specifier whose default resolution failed by mapping it
 * onto the source tree: a compiler-emitted `./x.js` (`.mjs`/`.cjs`) back to its
 * `./x.ts` (`.mts`/`.cts`) source, a concrete `.ts` Node refused, or an
 * extensionless `./x` to `./x.ts`/a directory index. Returns a `file:` URL for
 * the first on-disk match, or `null` (so the original error stands) when the
 * specifier is non-relative, has no usable parent, or matches nothing.
 */
function rescueSourceSpecifier(
  specifier: string,
  parentURL: string | undefined,
): string | null {
  if (!isRelativeSpecifier(specifier)) {
    return null;
  }
  if (parentURL === undefined || !parentURL.startsWith("file:")) {
    return null;
  }
  const parentDir = path.dirname(fileFromFileUrl(parentURL));
  // A `?query`/`#hash` suffix participates in module identity but not in file
  // resolution, so split it off, resolve the path, and re-attach it to the URL.
  const [pathPart, suffix] = splitSpecifierSuffix(specifier);
  const resolved = resolveSourcePathPart(pathPart, parentDir);
  return resolved === null ? null : resolved + suffix;
}

/** Resolve a relative specifier's path part to a `file:` URL on the source tree. */
function resolveSourcePathPart(
  pathPart: string,
  parentDir: string,
): string | null {
  if (hasConcreteExtension(pathPart)) {
    const target = path.resolve(parentDir, pathPart);
    // A `.js`/`.mjs`/`.cjs` the compiler emitted for a `.ts` source: try the
    // TypeScript counterpart(s) on disk.
    for (const candidate of typeScriptCounterparts(target)) {
      if (isFile(candidate)) {
        return pathToFileURL(candidate).href;
      }
    }
    // A concrete `.ts` (or a real `.js`) Node's resolver refused: accept it if
    // it actually exists.
    return isFile(target) ? pathToFileURL(target).href : null;
  }
  const base = path.resolve(parentDir, pathPart);
  for (const extension of RESOLVABLE_EXTENSIONS) {
    const candidate = base + extension;
    if (isFile(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  for (const extension of RESOLVABLE_EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`);
    if (isFile(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

/** Split a specifier into its path part and a `?query`/`#hash` suffix. */
function splitSpecifierSuffix(specifier: string): [string, string] {
  const match = /[?#]/.exec(specifier);
  return match === null
    ? [specifier, ""]
    : [specifier.slice(0, match.index), specifier.slice(match.index)];
}

/** The TypeScript source filenames a JavaScript emit extension maps back to. */
function typeScriptCounterparts(target: string): string[] {
  const lower = target.toLowerCase();
  if (lower.endsWith(".mjs")) {
    return [target.slice(0, -4) + ".mts"];
  }
  if (lower.endsWith(".cjs")) {
    return [target.slice(0, -4) + ".cts"];
  }
  if (lower.endsWith(".jsx")) {
    return [target.slice(0, -4) + ".tsx"];
  }
  if (lower.endsWith(".js")) {
    const stem = target.slice(0, -3);
    return [stem + ".ts", stem + ".tsx"];
  }
  return [];
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

/** True when a resolved `file:` URL points at a TypeScript source. */
function isTypeScriptUrl(url: string | undefined): boolean {
  return (
    url !== undefined &&
    url.startsWith("file:") &&
    isTypeScriptSource(fileFromFileUrl(url))
  );
}

/** The filesystem path of a `file:` URL, ignoring any `?query`/`#hash`. */
function fileFromFileUrl(url: string): string {
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  return fileURLToPath(parsed);
}

function isTypeScriptSource(filename: string): boolean {
  // Declaration files carry no runtime emit; they are never a runtime module,
  // so they are not ours to serve.
  if (/\.d\.[cm]?ts$/i.test(filename)) {
    return false;
  }
  const lower = filename.toLowerCase();
  return TYPESCRIPT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * The module format Node should run a served TypeScript source as.
 * `.mts`/`.cts` are authoritative by extension; for `.ts`/`.tsx` the compiled
 * bytes decide — matching exactly what tsgo emitted, which is more reliable
 * than re-deriving it from the package `type`.
 */
function moduleFormat(file: string, compiled: string): "module" | "commonjs" {
  const lower = file.toLowerCase();
  if (lower.endsWith(".mts")) {
    return "module";
  }
  if (lower.endsWith(".cts")) {
    return "commonjs";
  }
  return looksLikeESM(compiled) ? "module" : "commonjs";
}

/**
 * Heuristic: classify emitted JS as ESM when it carries an ESM-only marker — a
 * top-level `import`/`export` statement or `import.meta` — but none of the
 * well-known CommonJS patterns. The CJS checks run first so a re-exported CJS
 * bundle with both `require` calls and an `export` is conservatively treated as
 * CommonJS. `import.meta` is decisive on its own: a module may use it with no
 * `import`/`export` statement, and it is invalid in CommonJS.
 */
function looksLikeESM(output: string): boolean {
  if (
    /\bObject\.defineProperty\(exports\b/.test(output) ||
    /\bmodule\.exports\b/.test(output) ||
    /\brequire\(/.test(output) ||
    /\bexports\./.test(output)
  ) {
    return false;
  }
  return (
    /^\s*(?:import|export)\s/m.test(output) ||
    /\bimport\s*\.\s*meta\b/.test(output)
  );
}

/** True when `file` is a descendant of directory `root` (not `root` itself). */
function isInsideDirectory(root: string, file: string): boolean {
  const [a, b] =
    process.platform === "win32"
      ? [root.toLowerCase(), file.toLowerCase()]
      : [root, file];
  const relative = path.relative(a, b);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}

function realpathIfExists(filename: string): string {
  try {
    return fs.realpathSync(filename);
  } catch {
    return filename;
  }
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}
