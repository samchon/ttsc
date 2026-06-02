import { createHash } from "node:crypto";
import fs from "node:fs";
import type { ResolveHookSync } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveEmittedJavaScript } from "../../compiler/internal/resolveEmittedJavaScript";
import { runBuild } from "../../compiler/internal/runBuild";

/**
 * Node.js module-customization hook `ttsx` installs (via `registerHooks`) in
 * the child process it spawns. `registerHooks` is synchronous and in-thread, so
 * it covers BOTH `import` and `require` across the whole graph.
 *
 * The runtime never re-transpiles TypeScript: every `.ts` a dependency exposes
 * is served as the JavaScript tsgo emits for it, so the same compiler — with
 * the same type-checking, plugin transforms, and `import` elision — produces
 * the code that runs.
 *
 * - The entry project's own sources are already emitted by the up-front compile
 *   gate (`prepareExecution`); the hook resolves each mirrored `.ts` to the
 *   `.js` sitting beside it.
 * - A workspace dependency consumed as raw `.ts` (realpath outside the entry's
 *   mirror) is compiled by tsgo through its OWN `tsconfig` — a full,
 *   type-checked build into a per-package cache — and the hook resolves its
 *   `.ts` sources to that emitted output. Node never sees raw `.ts`, so the
 *   strip-only limits (`node_modules`, `namespace`/`enum`, un-elided type-only
 *   imports) never bite.
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
 * Resolve a specifier, then redirect any raw `.ts` it lands on to the
 * JavaScript tsgo emits for it.
 *
 * The default resolution runs first; on its failure an extensionless relative
 * specifier is rescued by probing candidate extensions (preserving
 * `ERR_MODULE_NOT_FOUND` for a genuinely missing module). Whatever URL results,
 * if it points at a `.ts` source it is replaced with the emitted `.js`.
 */
export const resolve: ResolveHookSync = (specifier, context, nextResolve) => {
  let result;
  try {
    result = nextResolve(specifier, context);
  } catch (error) {
    const rescued =
      probeRelativeSpecifier(specifier, context.parentURL) ??
      probeRedirectedTypeScriptSpecifier(specifier, context.parentURL);
    if (rescued === null) {
      throw error;
    }
    result = { shortCircuit: true, url: rescued };
  }
  const emitted = emittedJavaScriptUrl(result.url);
  if (emitted === null) {
    return result;
  }
  // Keep every field the resolver produced (e.g. `importAttributes`), only
  // dropping the resolved `.ts` source's `format` (e.g. `module-typescript`):
  // the redirect points at emitted JavaScript, and carrying the TypeScript
  // format would make Node try to type-strip a `.js`. With `format` gone Node
  // detects it from the file and the nearest `package.json`.
  const redirected = { ...result, shortCircuit: true, url: emitted };
  delete (redirected as { format?: unknown }).format;
  return redirected;
};

/**
 * Map a resolved `file:` URL pointing at a TypeScript source to the `file:` URL
 * of the JavaScript tsgo emitted for it, or `null` to leave the URL untouched
 * (already JavaScript, or a `.ts` with no emit available).
 */
function emittedJavaScriptUrl(url: string | undefined): string | null {
  if (url === undefined || !url.startsWith("file:")) {
    return null;
  }
  const file = fileURLToPath(url);
  if (!isTypeScriptSource(file)) {
    return null;
  }
  // Canonicalize once so the mirror test and the dependency build agree on the
  // path: the entry mirror, a symlinked workspace dependency, and a
  // case-insensitive filesystem can each spell the same file differently.
  const canonical = realpathIfExists(file);
  const emitted = isProjectMirror(canonical)
    ? gateEmittedSibling(canonical)
    : emittedDependencyFile(canonical);
  return emitted === null ? null : pathToFileURL(emitted).href;
}

/**
 * The entry project's own sources are mirrored beside the compile gate's emit,
 * so the JavaScript for a mirrored `.ts` is the `.js` of the same stem in the
 * same directory. A mirrored source with no `.js` beside it was loaded at
 * runtime but never emitted by the gate — surface that instead of letting Node
 * fail trying to load the raw `.ts`.
 */
function gateEmittedSibling(file: string): string {
  const js = withJsExtension(file);
  if (!isFile(js)) {
    throw new Error(
      `ttsx: ${file} was loaded at runtime but the compile gate emitted no ` +
        `JavaScript for it (is it included in the entry project's build?)`,
    );
  }
  return js;
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
 * Probe candidate extensions for a relative `specifier` whose bare form failed
 * to resolve. Returns a `file:` URL string for the first match, or `null` when
 * the specifier is non-relative, has no usable parent, or matches nothing.
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
  if (hasConcreteExtension(specifier)) {
    return null;
  }
  const parentDir = path.dirname(fileURLToPath(parentURL));
  const base = path.resolve(parentDir, specifier);
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

/**
 * Rescue a relative specifier that carries a concrete TypeScript-source
 * extension (`./plugins/beta.ts`) but failed to resolve. tsgo statically
 * rewrites a literal `import "./x.ts"` to `"./x.js"`, but a COMPUTED specifier
 * (`import(`./plugins/${name}.ts`)`) survives to runtime — where the emitted
 * parent lives in the per-package cache whose siblings are `.js`, not `.ts`, so
 * Node's own resolution misses. Map it to its JavaScript counterpart beside the
 * parent, gated on existence so a genuinely missing module still surfaces
 * `ERR_MODULE_NOT_FOUND`.
 */
function probeRedirectedTypeScriptSpecifier(
  specifier: string,
  parentURL: string | undefined,
): string | null {
  if (!isRelativeSpecifier(specifier)) {
    return null;
  }
  if (parentURL === undefined || !parentURL.startsWith("file:")) {
    return null;
  }
  if (!isTypeScriptSource(specifier)) {
    return null;
  }
  const parentDir = path.dirname(fileURLToPath(parentURL));
  const candidate = withJsExtension(path.resolve(parentDir, specifier));
  return isFile(candidate) ? pathToFileURL(candidate).href : null;
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
  // Declaration files carry no runtime emit; they are never a runtime module,
  // so they are not ours to redirect.
  if (/\.d\.[cm]?ts$/i.test(filename)) {
    return false;
  }
  const lower = filename.toLowerCase();
  return TYPESCRIPT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** Replace a TypeScript extension with its JavaScript counterpart. */
function withJsExtension(filename: string): string {
  return filename.replace(/\.([cm]?)tsx?$/i, ".$1js");
}

/**
 * True when `filename` is one of the entry project's own sources, which `ttsx`
 * mirrors beside the compile gate's emit. The mirror root is passed exactly via
 * `TTSC_TTSX_PROJECT_MIRROR`; absent that (an older launcher), fall back to the
 * default mirror location under `node_modules/.cache`.
 */
function isProjectMirror(filename: string): boolean {
  const root = process.env.TTSC_TTSX_PROJECT_MIRROR;
  if (root !== undefined && root !== "") {
    // `filename` is already canonicalized by the caller; canonicalize the root
    // the same way so a symlinked or differently-cased spelling still matches.
    return isInsideDirectory(realpathIfExists(root), filename);
  }
  const segments = filename.split(path.sep);
  for (let i = 0; i < segments.length - 1; i += 1) {
    if (segments[i] === "node_modules" && segments[i + 1] === ".cache") {
      return true;
    }
  }
  return false;
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
