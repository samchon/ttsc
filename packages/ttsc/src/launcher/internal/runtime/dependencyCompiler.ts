import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { readProjectConfig } from "../../../compiler/internal/project/readProjectConfig";
import { resolveEmittedJavaScript } from "../../../compiler/internal/resolveEmittedJavaScript";
import { runBuild } from "../../../compiler/internal/runBuild";
import { collectPluginDescriptorFiles } from "../../../plugin/internal/loadProjectPlugins";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import {
  isFile,
  isJavaScriptOutput,
  isTypeScriptSource,
  realPath,
} from "./paths";
import type { RuntimeEnv } from "./runtimeEnv";

/** Cache directory a dependency package's compiled JavaScript is promoted to. */
const CACHE_SEGMENTS = ["node_modules", ".cache", "ttsc", "ttsx-deps"] as const;
/** Freshness token written at the cache root once a build is complete. */
const STAMP_FILE = ".ttsx-stamp.json";

interface CompiledPackage {
  /** Promoted cache root holding the package's emitted JavaScript. */
  readonly cacheRoot: string;
  /** Source root the emit mirrors, used to map a `.ts` back to its `.js`. */
  readonly rootDir: string;
}

/** Per-process memo so each dependency package is compiled at most once. */
const compiledPackages = new Map<string, CompiledPackage>();

/**
 * Resolve the compiled JavaScript file whose bytes `ttsx` serves for a raw
 * `.ts` dependency source. The owning package is compiled once per process —
 * and once per on-disk cache across processes — into
 * `<package>/node_modules/.cache/ttsc/ttsx-deps`, with the project's transform
 * plugins applied. The compiled bytes are served under the original source URL,
 * so this only locates them; it never relocates the module's identity.
 */
export function resolveDependencyJavaScript(
  sourceFile: string,
  runtime: RuntimeEnv,
  packageRoot: string,
): string {
  const compiled = ensureCompiled(packageRoot, runtime);
  const jsFile = resolveEmittedJavaScript({
    outDir: compiled.cacheRoot,
    projectRoot: compiled.rootDir,
    sourceFile: realPath(sourceFile),
  });
  if (jsFile === null) {
    throw new Error(
      `ttsx: compiled ${packageRoot} but found no emitted JavaScript for ${sourceFile}`,
    );
  }
  return jsFile;
}

/** Compile `packageRoot` into its cache if stale, returning the cache handle. */
function ensureCompiled(
  packageRoot: string,
  runtime: RuntimeEnv,
): CompiledPackage {
  const cached = compiledPackages.get(packageRoot);
  if (cached !== undefined) {
    return cached;
  }
  const plan = planBuild(packageRoot, runtime);
  const cacheRoot = path.join(packageRoot, ...CACHE_SEGMENTS);
  if (readStamp(cacheRoot) !== plan.stamp) {
    buildAndPromote(packageRoot, cacheRoot, plan, runtime);
  }
  const compiled: CompiledPackage = { cacheRoot, rootDir: plan.rootDir };
  compiledPackages.set(packageRoot, compiled);
  return compiled;
}

interface BuildPlan {
  /** Tsconfig path tsgo builds with (the package's own, or a synthesized one). */
  readonly tsconfig: string;
  /** Source root the emit is relative to. */
  readonly rootDir: string;
  /** `--rootDir` to force when the package config omits one, else `[]`. */
  readonly rootDirArgs: readonly string[];
  /** Freshness token covering sources, resolved options, and plugin files. */
  readonly stamp: string;
  /** Synthesized tsconfig payload to write before building, when applicable. */
  readonly synthTsconfig: string | null;
}

/** Resolve the dependency's compile configuration and freshness stamp. */
function planBuild(packageRoot: string, runtime: RuntimeEnv): BuildPlan {
  const ownTsconfig = path.join(packageRoot, "tsconfig.json");
  const hasOwnTsconfig = isFile(ownTsconfig);

  let project: ITtscParsedProjectConfig;
  let synthTsconfig: string | null = null;
  let tsconfig: string;
  if (hasOwnTsconfig) {
    project = readProjectConfig({
      projectRoot: packageRoot,
      tsconfig: ownTsconfig,
    });
    tsconfig = ownTsconfig;
  } else {
    const options = synthesizedCompilerOptions();
    synthTsconfig = JSON.stringify({
      compilerOptions: { ...options, rootDir: packageRoot },
      files: listTypeScriptSources(packageRoot),
    });
    // The synthesized tsconfig is written into each build's private staging
    // dir (see buildAndPromote), never a shared path, so concurrent cold
    // builds of a tsconfig-less dependency never race on it.
    tsconfig = path.join(packageRoot, "tsconfig.json");
    project = {
      compilerOptions: { ...options, plugins: [] },
      path: tsconfig,
      pluginBaseDirs: [],
      root: packageRoot,
    };
  }

  const resolvedRootDir =
    typeof project.compilerOptions.rootDir === "string"
      ? path.resolve(packageRoot, project.compilerOptions.rootDir)
      : packageRoot;
  const pluginFiles = runtime.noPlugins
    ? []
    : collectPluginDescriptorFiles(project);
  return {
    tsconfig,
    rootDir: resolvedRootDir,
    rootDirArgs:
      typeof project.compilerOptions.rootDir === "string"
        ? []
        : ["--rootDir", packageRoot],
    stamp: computeStamp({
      configFiles: listConfigFiles(packageRoot),
      options: project.compilerOptions,
      pluginFiles,
      rootDir: resolvedRootDir,
      sources: listTypeScriptSources(packageRoot),
    }),
    synthTsconfig,
  };
}

/** Build into a private staging directory and atomically promote it. */
function buildAndPromote(
  packageRoot: string,
  cacheRoot: string,
  plan: BuildPlan,
  runtime: RuntimeEnv,
): void {
  const cacheParent = path.dirname(cacheRoot);
  fs.mkdirSync(cacheParent, { recursive: true });
  reapStaleScratch(cacheRoot);
  const staging = `${cacheRoot}.${process.pid}.${nextScratchId()}.staging`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  try {
    let tsconfig = plan.tsconfig;
    if (plan.synthTsconfig !== null) {
      // Write the synthesized tsconfig into this build's own staging dir so
      // concurrent builds never share or clobber it.
      tsconfig = path.join(staging, "ttsx-dep-tsconfig.json");
      fs.writeFileSync(tsconfig, plan.synthTsconfig, "utf8");
    }
    const result = runBuild({
      binary: runtime.tsgoBinary,
      cacheDir: runtime.cacheDir,
      cwd: packageRoot,
      emit: true,
      forceListEmittedFiles: true,
      outDir: staging,
      passthrough: [...plan.rootDirArgs],
      plugins: runtime.noPlugins ? false : undefined,
      projectRoot: packageRoot,
      quiet: true,
      tsconfig,
    });
    if (result.status !== 0) {
      throw new Error(
        [
          `ttsx: failed to compile dependency ${packageRoot}`,
          (result.stderr || result.stdout).trim(),
        ]
          .filter((line) => line.length !== 0)
          .join("\n"),
      );
    }
    if (!hasEmittedJavaScript(staging)) {
      throw new Error(
        `ttsx: no emitted JavaScript was found for dependency ${packageRoot} (cache ${cacheRoot})`,
      );
    }
    fs.writeFileSync(path.join(staging, STAMP_FILE), plan.stamp, "utf8");
    promote(staging, cacheRoot, plan.stamp);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Atomically publish `staging` as `cacheRoot`.
 *
 * A cold cache is the common race: many processes build into private staging
 * directories and the first `rename` wins. Losers observe `EEXIST`/`ENOTEMPTY`,
 * see the winner's matching stamp, and simply drop their staging. A stale cache
 * (a real rebuild, never concurrent in practice) is retired aside before the
 * fresh staging takes its place. Either way no scratch directory is left
 * behind.
 */
function promote(staging: string, cacheRoot: string, stamp: string): void {
  try {
    fs.renameSync(staging, cacheRoot);
    return;
  } catch (error) {
    if (!isAlreadyExists(error)) {
      throw error;
    }
  }
  if (readStamp(cacheRoot) === stamp) {
    fs.rmSync(staging, { recursive: true, force: true });
    return;
  }
  const retired = `${cacheRoot}.${process.pid}.${nextScratchId()}.retired`;
  try {
    fs.renameSync(cacheRoot, retired);
  } catch (error) {
    if (!isMissing(error)) {
      throw error;
    }
  }
  try {
    fs.renameSync(staging, cacheRoot);
  } catch (error) {
    if (!isAlreadyExists(error)) {
      throw error;
    }
    fs.rmSync(staging, { recursive: true, force: true });
  } finally {
    fs.rmSync(retired, { recursive: true, force: true });
  }
}

let scratchCounter = 0;

function nextScratchId(): number {
  scratchCounter += 1;
  return scratchCounter;
}

/**
 * Remove `.staging`/`.retired` scratch directories left behind by a crashed
 * build. Each scratch name embeds the owning pid; one whose pid is no longer
 * alive (and is not this process) is safe to delete. A live or reused-pid owner
 * is left untouched, so the worst case is a leak that clears on the next run.
 */
function reapStaleScratch(cacheRoot: string): void {
  const base = `${path.basename(cacheRoot)}.`;
  const parent = path.dirname(cacheRoot);
  let entries: string[];
  try {
    entries = fs.readdirSync(parent);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (
      !entry.startsWith(base) ||
      (!entry.endsWith(".staging") && !entry.endsWith(".retired"))
    ) {
      continue;
    }
    const pid = Number(entry.slice(base.length).split(".")[0]);
    if (Number.isInteger(pid) && pid !== process.pid && !isProcessAlive(pid)) {
      fs.rmSync(path.join(parent, entry), { recursive: true, force: true });
    }
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // ESRCH = no such process; EPERM = exists but not signalable by us.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function readStamp(cacheRoot: string): string | null {
  try {
    return fs.readFileSync(path.join(cacheRoot, STAMP_FILE), "utf8");
  } catch {
    return null;
  }
}

/**
 * Compute the freshness token. Each input file contributes its mtime and size;
 * the resolved compiler options (merged through the whole `extends` chain)
 * catch a base-config change no source mtime can see; plugin descriptor and
 * config files catch a transform/config edit; the root dir catches a layout
 * change. Mtime is the primary signal because edits advance it, and folding in
 * size catches a same-tick edit on a filesystem with coarse mtime resolution.
 */
function computeStamp(inputs: {
  configFiles: readonly string[];
  options: Record<string, unknown>;
  pluginFiles: readonly string[];
  rootDir: string;
  sources: readonly string[];
}): string {
  const hash = crypto.createHash("sha256");
  hash.update(`ttsx-deps\0${inputs.rootDir}\0`);
  hash.update(stableOptions(inputs.options));
  const files = [
    ...inputs.sources,
    ...inputs.pluginFiles,
    ...inputs.configFiles,
  ].sort();
  for (const file of files) {
    hash.update(`\0${file}\0${fileStamp(file)}`);
  }
  return hash.digest("hex");
}

function stableOptions(options: Record<string, unknown>): string {
  return JSON.stringify(options, Object.keys(options).sort());
}

function fileStamp(file: string): string {
  try {
    const stat = fs.statSync(file);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return "0:0";
  }
}

/**
 * Compiler options synthesized for a dependency that ships no tsconfig. The
 * `esnext` + `bundler` pair is the one combination tsgo accepts that also
 * resolves a package's raw `.ts` exports and the extensionless relative imports
 * workspace packages use. The emitted JavaScript keeps whatever module syntax
 * the source had, so each file's format is detected from its emit, not
 * assumed.
 */
function synthesizedCompilerOptions(): Record<string, unknown> {
  return {
    allowJs: false,
    esModuleInterop: true,
    module: "esnext",
    moduleResolution: "bundler",
    skipLibCheck: true,
    strict: false,
    target: "esnext",
  };
}

/** Recursively list a package's TypeScript sources, skipping nested installs. */
function listTypeScriptSources(packageRoot: string): string[] {
  return collectFiles(packageRoot, (name) => isTypeScriptSource(name));
}

/**
 * List a package's plugin configuration files. First-party plugin config lives
 * in `*.config.{ts,cts,mts,js,cjs,mjs,json}` files auto-discovered by upward
 * walk, so they shape the dependency's transformed emit just like its sources;
 * the freshness stamp tracks them so a banner/config edit forces a rebuild.
 */
function listConfigFiles(packageRoot: string): string[] {
  return collectFiles(packageRoot, (name) =>
    /\.config\.(?:[cm]?ts|[cm]?js|json)$/i.test(name),
  );
}

/** Recursively collect matching files under `root`, skipping nested installs. */
function collectFiles(
  root: string,
  match: (name: string) => boolean,
): string[] {
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
      if (entry.name === "node_modules") {
        continue;
      }
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile() && match(entry.name)) {
        out.push(next);
      }
    }
  }
  return out.sort();
}

/** True when at least one JavaScript file exists anywhere under `root`. */
function hasEmittedJavaScript(root: string): boolean {
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
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name));
      } else if (entry.isFile() && isJavaScriptOutput(entry.name)) {
        return true;
      }
    }
  }
  return false;
}

function isAlreadyExists(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "EEXIST" || code === "ENOTEMPTY";
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}
