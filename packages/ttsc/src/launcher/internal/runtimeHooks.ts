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
    const rescued = probeRelativeSpecifier(specifier, context.parentURL);
    if (rescued === null) {
      throw error;
    }
    result = { shortCircuit: true, url: rescued };
  }
  const emitted = emittedJavaScriptUrl(result.url);
  // Drop the resolved `.ts` source's `format` (e.g. `module-typescript`): the
  // redirect points at emitted JavaScript, and carrying the TypeScript format
  // would make Node try to type-strip a `.js`. Letting `format` go undefined
  // has Node detect it from the file and the nearest `package.json`.
  return emitted === null ? result : { shortCircuit: true, url: emitted };
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
  const emitted = isProjectMirror(file)
    ? gateEmittedSibling(file)
    : emittedDependencyFile(realpathIfExists(file));
  return emitted === null ? null : pathToFileURL(emitted).href;
}

/**
 * The entry project's own sources are mirrored beside the compile gate's emit,
 * so the JavaScript for a mirrored `.ts` is the `.js` of the same stem in the
 * same directory.
 */
function gateEmittedSibling(file: string): string | null {
  const js = withJsExtension(file);
  return isFile(js) ? js : null;
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
    // The package built, but tsgo emitted nothing for this source (e.g. its
    // own `tsconfig` excludes the file). Surface it instead of letting Node
    // fail loading the raw `.ts`.
    throw new Error(
      `ttsx: no JavaScript was emitted for ${sourceFile}; ` +
        `its package at ${packageRoot} excludes it from the build`,
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
  const stamp = freshnessStamp(packageRoot, project.tsconfig);
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
      throw new Error(
        `ttsx: failed to compile dependency package ${packageRoot}\n` +
          (result.stderr || result.stdout),
      );
    }
    fs.writeFileSync(path.join(staging, STAMP_FILE), stamp, "utf8");
    promoteDirectory(staging, outDir);
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
} {
  const own = ownProjectConfig(packageRoot);
  if (own !== null) {
    return own;
  }
  const root = toPosix(packageRoot);
  const content = JSON.stringify(
    {
      compilerOptions: {
        module: "preserve",
        moduleResolution: "bundler",
        rootDir: root,
        // The entry compile gate already type-checked this dependency in the
        // consuming program; this build only needs runnable emit, so library
        // declaration files are skipped.
        skipLibCheck: true,
        target: "esnext",
      },
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
  return { emitBase: packageRoot, tsconfig };
}

/**
 * The package's own `tsconfig` (and its emit base) when one sits at the package
 * root, or `null` when the nearest config belongs to an ancestor — an ancestor
 * config must not be mistaken for the package's own build.
 */
function ownProjectConfig(
  packageRoot: string,
): { tsconfig: string; emitBase: string } | null {
  let project: ReturnType<typeof readProjectConfig>;
  try {
    project = readProjectConfig({ cwd: packageRoot });
  } catch {
    return null;
  }
  if (path.resolve(project.root) !== path.resolve(packageRoot)) {
    return null;
  }
  return { emitBase: emitBaseDirectory(project), tsconfig: project.path };
}

/**
 * A string that changes whenever the cache must be rebuilt: the ttsc version
 * (emit logic), the tsconfig path, and the newest mtime among the package's
 * `.ts` sources and that tsconfig. A completed cache stores this; a later run
 * reuses the cache only on an exact match.
 */
function freshnessStamp(packageRoot: string, tsconfig: string): string {
  let newest = statMtimeMs(tsconfig);
  for (const source of typeScriptSources(packageRoot)) {
    const mtime = statMtimeMs(source);
    if (mtime > newest) {
      newest = mtime;
    }
  }
  return JSON.stringify({ version: ttscVersion(), tsconfig, newest });
}

/** Read a cache's freshness stamp, or `null` when it is absent or unreadable. */
function readStamp(outDir: string): string | null {
  return readFileOrNull(path.join(outDir, STAMP_FILE));
}

/**
 * Move `staging` onto `outDir` as a complete unit. A plain rename wins when
 * `outDir` is absent; otherwise the existing cache is swapped aside and
 * removed. A concurrent process that promoted first is left in place — its emit
 * is identical (the build is deterministic), so either copy is correct.
 */
function promoteDirectory(staging: string, outDir: string): void {
  fs.mkdirSync(path.dirname(outDir), { recursive: true });
  try {
    fs.renameSync(staging, outDir);
    return;
  } catch {
    // `outDir` already exists; fall through to swap it out.
  }
  const retired = `${outDir}.${process.pid}.${(stagingCounter += 1)}.retired`;
  try {
    fs.renameSync(outDir, retired);
    fs.renameSync(staging, outDir);
  } catch {
    // A concurrent process promoted first; keep theirs.
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
  return TYPESCRIPT_EXTENSIONS.some((extension) =>
    filename.endsWith(extension),
  );
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
    const relative = path.relative(root, filename);
    return (
      relative !== "" &&
      !relative.startsWith("..") &&
      !path.isAbsolute(relative)
    );
  }
  const segments = filename.split(path.sep);
  for (let i = 0; i < segments.length - 1; i += 1) {
    if (segments[i] === "node_modules" && segments[i + 1] === ".cache") {
      return true;
    }
  }
  return false;
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
