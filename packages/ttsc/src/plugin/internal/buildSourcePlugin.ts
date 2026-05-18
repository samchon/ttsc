import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const GO_MOD_SEARCH_MAX_DEPTH = 3;
const TTSC_GO_MODULE_PATH = "github.com/samchon/ttsc/packages/ttsc";
const TSGO_GO_MODULE_PATH = "github.com/microsoft/typescript-go";

const PRUNE_DIRS = new Set(["node_modules", ".git", ".ttsc"]);
const GENERATED_WORKSPACE_FILES = new Set(["go.work", "go.work.sum"]);

// Go build environment values that can change the produced binary or decide
// whether `go build` succeeds. Hashed into the plugin cache key so target,
// build-tag, cgo, FIPS, and external-link variants never collide.
const GO_BUILD_ENV_KEYS: readonly string[] = [
  "GOOS",
  "GOARCH",
  "GOAMD64",
  "GOARM",
  "GOARM64",
  "GO386",
  "GOMIPS",
  "GOMIPS64",
  "GOPPC64",
  "GORISCV64",
  "GOWASM",
  "GOFLAGS",
  "GOEXPERIMENT",
  "GOFIPS140",
  "GO_EXTLINK_ENABLED",
  "GCCGO",
  "GCCGOTOOLDIR",
  "CGO_ENABLED",
  "AR",
  "CC",
  "CXX",
  "FC",
  "PKG_CONFIG",
  "CGO_CFLAGS",
  "CGO_CFLAGS_ALLOW",
  "CGO_CFLAGS_DISALLOW",
  "CGO_CPPFLAGS",
  "CGO_CPPFLAGS_ALLOW",
  "CGO_CPPFLAGS_DISALLOW",
  "CGO_CXXFLAGS",
  "CGO_CXXFLAGS_ALLOW",
  "CGO_CXXFLAGS_DISALLOW",
  "CGO_FFLAGS",
  "CGO_FFLAGS_ALLOW",
  "CGO_FFLAGS_DISALLOW",
  "CGO_LDFLAGS",
  "CGO_LDFLAGS_ALLOW",
  "CGO_LDFLAGS_DISALLOW",
  "GOTOOLCHAIN",
  "GOROOT",
];
const GO_BUILD_COMMAND_ENV_KEYS = new Set([
  "AR",
  "CC",
  "CXX",
  "FC",
  "GCCGO",
  "PKG_CONFIG",
]);
const EXTERNAL_GO_BUILD_ENV_KEYS: readonly string[] = [
  "CPATH",
  "C_INCLUDE_PATH",
  "CPLUS_INCLUDE_PATH",
  "DYLD_LIBRARY_PATH",
  "INCLUDE",
  "LD_LIBRARY_PATH",
  "LIB",
  "LIBRARY_PATH",
  "LIBPATH",
  "MACOSX_DEPLOYMENT_TARGET",
  "OBJC_INCLUDE_PATH",
  "PKG_CONFIG_ALLOW_SYSTEM_CFLAGS",
  "PKG_CONFIG_ALLOW_SYSTEM_LIBS",
  "PKG_CONFIG_LIBDIR",
  "PKG_CONFIG_PATH",
  "PKG_CONFIG_SYSROOT_DIR",
  "PKG_CONFIG_TOP_BUILD_DIR",
  "SDKROOT",
];
const CONTRIBUTIONS_FILE_NAME = "ttsc_contributions.go";
const CONTRIB_DIRNAME = "contrib";
const GLOBAL_CACHE_DIRNAME = "ttsc";
const PLUGIN_CACHE_DIRNAME = "plugins";
const CACHE_LAST_USED_FILE = ".last-used";
const CACHE_GC_MARKER_FILE = ".gc-last-run";
const GLOBAL_CACHE_GC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const GLOBAL_CACHE_ENTRY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const GLOBAL_CACHE_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const GLOBAL_CACHE_TARGET_BYTES = Math.floor(GLOBAL_CACHE_MAX_BYTES * 0.8);
const GLOBAL_CACHE_PROTECTED_AGE_MS = 60 * 60 * 1000;

/** One contributor's resolved Go source plus its target sub-package name. */
export interface ITtscBuildContributor {
  /** Sub-package suffix: scratch lands at `<host>/contrib/<name>/`. */
  name: string;
  /** Absolute path to the contributor's source directory. */
  source: string;
}

/** Build one Go source plugin into a cached executable. */
export function buildSourcePlugin(opts: {
  source: string;
  pluginName: string;
  baseDir: string;
  cacheDir?: string;
  contributors?: readonly ITtscBuildContributor[];
  label?: string;
  overlayDirs?: readonly string[];
  quiet?: boolean;
  ttscVersion: string;
  tsgoVersion: string;
}): string {
  const { dir, entry, source } = resolveSourceBuildTarget(opts);
  const overlayDirs = [...(opts.overlayDirs ?? findTtscOverlayDirs())].sort();
  const contributors = opts.contributors ?? [];
  const goBinary = resolveGoCompiler();
  ensureExecutableGoToolchain(goBinary);
  const key = computeCacheKey({
    contributors,
    dir,
    entry,
    goBinary,
    overlayDirs,
    ttscVersion: opts.ttscVersion,
    tsgoVersion: opts.tsgoVersion,
  });
  const root = resolvePluginCacheRoot(opts.baseDir, opts.cacheDir);
  const cacheDir = path.join(root, key);
  const binaryName = process.platform === "win32" ? "plugin.exe" : "plugin";
  const binaryPath = path.join(cacheDir, binaryName);
  if (fs.existsSync(binaryPath)) {
    touchCacheEntry(cacheDir);
    return binaryPath;
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  const label = opts.label ?? "source plugin";
  if (opts.quiet !== true) {
    const extra =
      contributors.length === 0
        ? ""
        : ` + ${contributors.length} contributor(s): ${contributors
            .map((c) => c.name)
            .join(", ")}`;
    process.stderr.write(
      `ttsc: building ${label} "${opts.pluginName}" from ${source}${extra} (this runs once per cache key)\n`,
    );
  }

  const scratchDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `ttsc-plugin-${key}-`),
  );
  try {
    materializeScratchDir(dir, scratchDir);
    const goModReader = createGoModReader(goBinary, opts.pluginName);
    if (contributors.length > 0) {
      mergeContributors({
        contributors,
        entry,
        goModReader,
        pluginName: opts.pluginName,
        scratchDir,
      });
    }
    writeGoWork(scratchDir, overlayDirs, goBinary, opts.pluginName);
    const scratchBinaryName =
      process.platform === "win32" ? ".ttsc-plugin.exe" : ".ttsc-plugin";
    runGoBuild(scratchDir, entry, scratchBinaryName, opts.pluginName, goBinary);
    const builtBinary = path.join(scratchDir, scratchBinaryName);
    publishBuiltBinary(builtBinary, binaryPath);
    touchCacheEntry(cacheDir);
    return binaryPath;
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }
}

/**
 * Copy every contributor's Go source into a sub-package of the host module and
 * synthesize a blank-import file alongside the host's entry package so each
 * contributor's `init()` runs before `main`.
 *
 * - Sources land at `<scratch>/<CONTRIB_DIRNAME>/<name>/` (recursive copy with
 *   the same pruning rules used for the host source).
 * - The entry directory receives `<CONTRIBUTIONS_FILE_NAME>` containing one
 *   blank-import per contributor. The host's module path is read from the
 *   materialized go.mod, so the import path is always correct for the host
 *   plugin's actual module declaration.
 * - Contributors that ship their own `go.mod` are rejected — the design relies on
 *   the contributor living inside the host's module so that workspace overlay
 *   rules and the host's `go.sum` cover transitive dependencies. This also
 *   closes the supply-chain hole where a contributor could otherwise pull in
 *   arbitrary Go modules.
 */
function mergeContributors(opts: {
  contributors: readonly ITtscBuildContributor[];
  entry: string;
  goModReader: GoModReader;
  pluginName: string;
  scratchDir: string;
}): void {
  const hostModulePath = opts.goModReader.read(opts.scratchDir).modulePath;
  if (hostModulePath === null || hostModulePath === "") {
    throw new Error(
      `ttsc: plugin "${opts.pluginName}" cannot accept contributors because its module ` +
        `root has no resolvable go.mod module path`,
    );
  }
  const contribRoot = path.join(opts.scratchDir, CONTRIB_DIRNAME);
  // Refuse to merge when the host plugin's own source already owns a
  // `contrib/` directory. We'd otherwise silently merge contributor
  // files into a pre-populated host package and ship a hybrid binary
  // whose contents nobody declared. Loud failure is the only safe
  // option — the host plugin must rename its directory or the
  // contributor system must use a different sub-package root.
  if (fs.existsSync(contribRoot)) {
    throw new Error(
      `ttsc: plugin "${opts.pluginName}" already ships a ${CONTRIB_DIRNAME}/ directory in its source; ` +
        `contributor merge would silently overwrite. Rename the host plugin's directory to a different name.`,
    );
  }
  fs.mkdirSync(contribRoot, { recursive: true });
  // Sort contributors by name so the synthesized `ttsc_contributions.go`
  // emits blank imports in a deterministic order independent of
  // declaration order. The cache key is already sort-stable
  // (`computeCacheKey` sorts contributors by name), so without this
  // matching sort the SAME cache key could correspond to two distinct
  // binaries whose `init()` sequence across contributors differs by
  // import order.
  const sortedContributors = [...opts.contributors].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  const imports: string[] = [];
  for (const contributor of sortedContributors) {
    if (fs.existsSync(path.join(contributor.source, "go.mod"))) {
      throw new Error(
        `ttsc: plugin "${opts.pluginName}" contributor "${contributor.name}" must ship Go ` +
          `source as a package, not a module (go.mod found at ${contributor.source}/go.mod). ` +
          `Remove go.mod so the contributor compiles inside the host module's dependency graph.`,
      );
    }
    const target = path.join(contribRoot, contributor.name);
    if (fs.existsSync(target)) {
      // Defensive: validatePluginContributors already rejects duplicate
      // names, and the contribRoot-existence guard above blocks the
      // host plugin from pre-shipping a `contrib/` directory. Reaching
      // this branch implies an upstream contract break. Fail loud
      // rather than overwrite.
      throw new Error(
        `ttsc: plugin "${opts.pluginName}" contributor "${contributor.name}" target ${target} already exists; ` +
          `contributor names must be unique within one plugin build`,
      );
    }
    fs.cpSync(contributor.source, target, {
      recursive: true,
      filter: (src) => {
        const base = path.basename(src);
        if (shouldPruneDirectory(base)) return false;
        if (shouldOmitSourceFile(base)) return false;
        return true;
      },
    });
    imports.push(`${hostModulePath}/${CONTRIB_DIRNAME}/${contributor.name}`);
  }
  const entryDir = path.resolve(opts.scratchDir, opts.entry);
  fs.mkdirSync(entryDir, { recursive: true });
  const contributionsPath = path.join(entryDir, CONTRIBUTIONS_FILE_NAME);
  // Same reasoning as the contribRoot guard: when entry resolves to the
  // module root (`entry === "."`), entryDir == scratchDir and a
  // pre-existing `ttsc_contributions.go` from the host plugin's own
  // source would be silently overwritten by the generator below.
  if (fs.existsSync(contributionsPath)) {
    throw new Error(
      `ttsc: plugin "${opts.pluginName}" already ships ${CONTRIBUTIONS_FILE_NAME} in its entry package; ` +
        `that filename is reserved for the contributor blank-import generator. Rename the host's file.`,
    );
  }
  writeContributionsFile(contributionsPath, imports);
}

function writeContributionsFile(filePath: string, imports: string[]): void {
  const importLines = imports
    .map((spec) => `\t_ ${JSON.stringify(spec)}`)
    .join("\n");
  const body = `// Code generated by ttsc — DO NOT EDIT.
//
// This file is synthesized by ttsc's plugin builder when the host plugin
// descriptor declares "contributors". The blank imports below pull each
// contributor sub-package into the build so its init() runs before main.

package main

import (
${importLines}
)
`;
  fs.writeFileSync(filePath, body, "utf8");
}

function publishBuiltBinary(builtBinary: string, binaryPath: string): void {
  const pending = `${binaryPath}.${process.pid}.${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}.tmp`;
  fs.copyFileSync(builtBinary, pending);
  if (process.platform !== "win32") {
    fs.chmodSync(pending, 0o755);
  }
  try {
    fs.renameSync(pending, binaryPath);
  } catch (error) {
    fs.rmSync(pending, { force: true });
    const code = (error as NodeJS.ErrnoException).code;
    if (
      (code === "EEXIST" || code === "EPERM" || code === "EACCES") &&
      fs.existsSync(binaryPath)
    ) {
      return;
    }
    throw error;
  } finally {
    // Best-effort sweep of any leftover `.tmp` siblings from a prior
    // crash between copyFileSync and renameSync. Same-directory pending
    // names guarantee the rename stays a same-filesystem atomic op, so
    // we accept the GC cost rather than move pending files to os.tmpdir.
    pruneOrphanPendingBinaries(binaryPath);
  }
}

function pruneOrphanPendingBinaries(binaryPath: string): void {
  // Only sweep pending files owned by THIS process. Concurrent ttsc
  // invocations (two `ttsc --watch` shells against the same project)
  // may have their own `<binary>.<their-pid>.*.tmp` mid-flight, and
  // deleting them would race their renameSync into ENOENT.
  try {
    const dir = path.dirname(binaryPath);
    const prefix = `${path.basename(binaryPath)}.${process.pid}.`;
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith(prefix) && name.endsWith(".tmp")) {
        fs.rmSync(path.join(dir, name), { force: true });
      }
    }
  } catch {
    // Best-effort; never mask the underlying publish outcome.
  }
}

function resolveSourceBuildTarget(opts: {
  source: string;
  pluginName: string;
  baseDir: string;
}): {
  dir: string;
  entry: string;
  source: string;
} {
  const source = path.isAbsolute(opts.source)
    ? opts.source
    : path.resolve(opts.baseDir, opts.source);
  if (!fs.existsSync(source)) {
    throw new Error(
      `ttsc: plugin "${opts.pluginName}" source does not exist: ${source}`,
    );
  }

  const stat = fs.statSync(source);
  const packageDir =
    stat.isFile() && path.basename(source) === "go.mod"
      ? path.dirname(source)
      : stat.isDirectory()
        ? source
        : null;
  if (packageDir === null) {
    throw new Error(
      `ttsc: plugin "${opts.pluginName}" source must be a Go package directory or go.mod file: ${source}`,
    );
  }

  const goMod = findNearestGoMod(packageDir, GO_MOD_SEARCH_MAX_DEPTH);
  if (goMod === null) {
    throw new Error(
      `ttsc: plugin "${opts.pluginName}" source must be inside a Go module with go.mod within ${GO_MOD_SEARCH_MAX_DEPTH} parent directories: ${source}`,
    );
  }
  const dir = path.dirname(goMod);
  const rel = path.relative(dir, packageDir).replace(/\\/g, "/");
  return {
    dir,
    entry: rel === "" ? "." : `./${rel}`,
    source,
  };
}

function findNearestGoMod(from: string, maxDepth: number): string | null {
  let current = path.resolve(from);
  let depth = 0;
  while (true) {
    const candidate = path.join(current, "go.mod");
    if (fs.existsSync(candidate)) return candidate;
    if (depth >= maxDepth) return null;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
    depth += 1;
  }
}

function materializeScratchDir(source: string, scratch: string): void {
  fs.mkdirSync(scratch, { recursive: true });
  fs.cpSync(source, scratch, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      if (shouldPruneDirectory(base)) return false;
      if (shouldOmitSourceFile(base)) return false;
      return true;
    },
  });
}

function writeGoWork(
  scratchDir: string,
  useDirs: readonly string[],
  goBinary: string,
  pluginName: string,
): void {
  const goModReader = createGoModReader(goBinary, pluginName);
  validateSourceReplacements(scratchDir, useDirs, goModReader, pluginName);
  const sourceInfo = goModReader.read(scratchDir);
  const effectiveUseDirs =
    sourceInfo.modulePath === TTSC_GO_MODULE_PATH
      ? useDirs.filter((dir) => {
          const modulePath = goModReader.read(dir).modulePath;
          return modulePath !== null && !isTtscManagedModulePath(modulePath);
        })
      : useDirs;
  const useLines = ["\t."];
  for (const dir of effectiveUseDirs) {
    useLines.push(`\t${dir.replace(/\\/g, "/")}`);
  }
  const replaceLines = sourceBuildWorkspaceReplacements(
    effectiveUseDirs,
    goModReader,
  );
  const replaceBlock =
    replaceLines.length === 0 ? "" : `\n\n${replaceLines.join("\n")}\n`;
  const goWork = `go 1.26\n\nuse (\n${useLines.join("\n")}\n)${replaceBlock}`;
  fs.writeFileSync(path.join(scratchDir, "go.work"), goWork, "utf8");
}

function validateSourceReplacements(
  scratchDir: string,
  useDirs: readonly string[],
  goModReader: GoModReader,
  pluginName: string,
): void {
  const sourceInfo = goModReader.read(scratchDir);
  if (sourceInfo.modulePath === TTSC_GO_MODULE_PATH) {
    return;
  }
  const sourceReplacements = sourceInfo.replacements;
  if (sourceReplacements.length === 0) {
    return;
  }
  const overlayModules = collectOverlayModulePaths(useDirs, goModReader);
  for (const replacement of sourceReplacements) {
    if (
      isTtscManagedModulePath(replacement.modulePath) ||
      overlayModules.has(replacement.modulePath)
    ) {
      throw new Error(
        `ttsc: plugin "${pluginName}" go.mod replaces ttsc-managed module ` +
          `${JSON.stringify(replacement.modulePath)}. Remove this replace directive; ` +
          `ttsc supplies its own compiler and shim modules while building source plugins.`,
      );
    }
  }
}

function sourceBuildWorkspaceReplacements(
  useDirs: readonly string[],
  goModReader: GoModReader,
): string[] {
  const ttscRoot = useDirs.find(
    (dir) => goModReader.read(dir).modulePath === TTSC_GO_MODULE_PATH,
  );
  if (!ttscRoot) {
    return [];
  }
  return [
    `replace ${TTSC_GO_MODULE_PATH} v0.0.0 => ${ttscRoot.replace(/\\/g, "/")}`,
  ];
}

interface GoModReplacement {
  readonly modulePath: string;
}

interface GoModInfo {
  readonly modulePath: string | null;
  readonly replacements: readonly GoModReplacement[];
}

interface GoModReader {
  read(dir: string): GoModInfo;
}

interface GoModJson {
  readonly Module?: {
    readonly Path?: string;
  };
  readonly Require?: readonly {
    readonly Path?: string;
    readonly Version?: string;
  }[];
  readonly Replace?: readonly {
    readonly Old?: {
      readonly Path?: string;
      readonly Version?: string;
    };
    readonly New?: {
      readonly Path?: string;
      readonly Version?: string;
    };
  }[];
}

function createGoModReader(goBinary: string, pluginName: string): GoModReader {
  const cache = new Map<string, GoModInfo>();
  return {
    read(dir) {
      const resolved = path.resolve(dir);
      const cached = cache.get(resolved);
      if (cached !== undefined) {
        return cached;
      }
      const info = readGoModInfo(resolved, goBinary, pluginName);
      cache.set(resolved, info);
      return info;
    },
  };
}

function readGoModInfo(
  dir: string,
  goBinary: string,
  pluginName: string,
): GoModInfo {
  if (!fs.existsSync(path.join(dir, "go.mod"))) {
    return emptyGoModInfo();
  }

  const result = spawnSync(goBinary, ["mod", "edit", "-json"], {
    cwd: dir,
    encoding: "utf8",
    env: goBuildEnv(goBinary),
    maxBuffer: 1024 * 1024 * 16,
    windowsHide: true,
  });
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(goToolchainNotFoundMessage(pluginName));
    }
    throw new Error(
      `ttsc: reading go.mod for plugin "${pluginName}" failed to spawn ${goBinary}: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `ttsc: reading go.mod for plugin "${pluginName}" failed:\n${result.stderr || result.stdout}`,
    );
  }

  let json: GoModJson;
  try {
    json = JSON.parse(result.stdout) as GoModJson;
  } catch (error) {
    throw new Error(
      `ttsc: reading go.mod for plugin "${pluginName}" returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return {
    modulePath: json.Module?.Path ?? null,
    replacements: (json.Replace ?? [])
      .map(jsonReplacementToGoModReplacement)
      .filter((replacement) => replacement !== null),
  };
}

function emptyGoModInfo(): GoModInfo {
  return {
    modulePath: null,
    replacements: [],
  };
}

function jsonReplacementToGoModReplacement(
  replacement: NonNullable<GoModJson["Replace"]>[number],
): GoModReplacement | null {
  const modulePath = replacement.Old?.Path;
  if (modulePath === undefined) {
    return null;
  }
  return {
    modulePath,
  };
}

function collectOverlayModulePaths(
  dirs: readonly string[],
  goModReader: GoModReader,
): Set<string> {
  const out = new Set<string>();
  for (const dir of dirs) {
    const modulePath = goModReader.read(dir).modulePath;
    if (modulePath !== null) {
      out.add(modulePath);
    }
  }
  return out;
}

function isTtscManagedModulePath(modulePath: string): boolean {
  return (
    modulePath === TTSC_GO_MODULE_PATH ||
    modulePath === TSGO_GO_MODULE_PATH ||
    modulePath.startsWith("github.com/microsoft/typescript-go/shim/")
  );
}

function runGoBuild(
  cwd: string,
  entry: string,
  binaryName: string,
  pluginName: string,
  goBinary: string,
): void {
  ensureExecutableGoToolchain(goBinary);
  const result = spawnSync(goBinary, ["build", "-o", binaryName, entry], {
    cwd,
    encoding: "utf8",
    env: goBuildEnv(goBinary),
    maxBuffer: 1024 * 1024 * 64,
    windowsHide: true,
  });
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(goToolchainNotFoundMessage(pluginName));
    }
    throw new Error(
      `ttsc: building plugin "${pluginName}" failed to spawn ${goBinary}: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `ttsc: building plugin "${pluginName}" via "go build" failed:\n${result.stderr || result.stdout}`,
    );
  }
}

function goToolchainNotFoundMessage(pluginName: string): string {
  return (
    `ttsc: building plugin "${pluginName}" failed because the Go toolchain was not found. ` +
    `Reinstall ttsc with optional dependencies so the bundled Go compiler is present, ` +
    `or set TTSC_GO_BINARY to an absolute path.`
  );
}

function goBuildEnv(goBinary: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  env.GOWORK = "auto";
  const goRoot = inferGoRoot(goBinary);
  if (goRoot && !env.GOROOT) {
    env.GOROOT = goRoot;
  }
  return env;
}

function inferGoRoot(goBinary: string): string | null {
  if (!path.isAbsolute(goBinary)) return null;
  const binDir = path.dirname(goBinary);
  if (path.basename(binDir) !== "bin") return null;
  const goRoot = path.dirname(binDir);
  return fs.existsSync(path.join(goRoot, "src", "runtime")) ? goRoot : null;
}

function ensureExecutableGoToolchain(goBinary: string): void {
  if (process.platform === "win32") return;
  if (!path.isAbsolute(goBinary) || !fs.existsSync(goBinary)) return;
  try {
    fs.chmodSync(goBinary, 0o755);
    const goRoot = inferGoRoot(goBinary);
    if (!goRoot) return;
    const gofmt = path.join(path.dirname(goBinary), "gofmt");
    if (fs.existsSync(gofmt)) fs.chmodSync(gofmt, 0o755);
    const toolDir = path.join(goRoot, "pkg", "tool");
    if (!fs.existsSync(toolDir)) return;
    for (const file of walkToolFiles(toolDir)) {
      fs.chmodSync(file, 0o755);
    }
  } catch {
    // Let the subsequent go build spawn fail with the real OS error.
  }
}

function walkToolFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkToolFiles(file));
    } else if (entry.isFile()) {
      out.push(file);
    }
  }
  return out;
}

function findTtscOverlayDirs(): readonly string[] {
  const ttscRoot = path.resolve(__dirname, "..", "..", "..");
  const dirs: string[] = [];
  if (fs.existsSync(path.join(ttscRoot, "go.mod"))) {
    dirs.push(ttscRoot);
  }
  const shimRoot = path.join(ttscRoot, "shim");
  if (fs.existsSync(shimRoot)) {
    walkForGoMod(shimRoot, dirs);
  }
  dirs.sort();
  return dirs;
}

function walkForGoMod(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  let hasGoMod = false;
  for (const entry of entries) {
    if (entry.isFile() && entry.name === "go.mod") {
      hasGoMod = true;
    }
  }
  if (hasGoMod) {
    out.push(dir);
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (shouldPruneDirectory(entry.name)) continue;
    walkForGoMod(path.join(dir, entry.name), out);
  }
}

export function resolvePluginCacheRoot(
  projectRoot: string,
  cacheDir?: string,
): string {
  if (cacheDir) {
    return path.resolve(projectRoot, cacheDir, PLUGIN_CACHE_DIRNAME);
  }
  if (process.env.TTSC_CACHE_DIR) {
    return path.resolve(process.env.TTSC_CACHE_DIR, PLUGIN_CACHE_DIRNAME);
  }
  const root = resolveGlobalPluginCacheRoot();
  maybePruneGlobalPluginCache(root);
  return root;
}

export function resolveGlobalPluginCacheRoot(): string {
  return path.join(
    resolveUserCacheRoot(),
    GLOBAL_CACHE_DIRNAME,
    PLUGIN_CACHE_DIRNAME,
  );
}

export function defaultPluginCacheCleanTargets(projectRoot: string): string[] {
  return [
    resolveGlobalPluginCacheRoot(),
    path.join(projectRoot, "node_modules", ".ttsc"),
    path.join(projectRoot, ".ttsc"),
  ];
}

function resolveUserCacheRoot(): string {
  const xdg = process.env.XDG_CACHE_HOME;
  if (xdg && path.isAbsolute(xdg)) {
    return xdg;
  }
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA;
    if (local && path.isAbsolute(local)) {
      return local;
    }
    const home = os.homedir();
    if (home) {
      return path.join(home, "AppData", "Local");
    }
  }
  if (process.platform === "darwin") {
    const home = os.homedir();
    if (home) {
      return path.join(home, "Library", "Caches");
    }
  }
  const home = os.homedir();
  if (home) {
    return path.join(home, ".cache");
  }
  return path.join(os.tmpdir(), "ttsc-cache");
}

function resolveGoCompiler(): string {
  const explicit = process.env.TTSC_GO_BINARY;
  if (explicit && explicit.length > 0) return explicit;

  try {
    return createRequire(__filename).resolve(
      `@ttsc/${process.platform}-${process.arch}/bin/go/bin/${process.platform === "win32" ? "go.exe" : "go"}`,
    );
  } catch {
    /* fall through */
  }

  const platformPackage = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    `ttsc-${process.platform}-${process.arch}`,
    "bin",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  if (fs.existsSync(platformPackage)) return platformPackage;

  const local = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "native",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  if (fs.existsSync(local)) return local;

  const homeSdk = path.join(
    process.env.HOME ?? "",
    "go-sdk",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  if (fs.existsSync(homeSdk)) return homeSdk;

  return "go";
}

export function computeCacheKey(inputs: {
  contributors?: readonly ITtscBuildContributor[];
  dir: string;
  entry: string;
  goBinary?: string;
  overlayDirs?: readonly string[];
  ttscVersion: string;
  tsgoVersion: string;
}): string {
  const hash = crypto.createHash("sha256");
  hash.update(`ttsc=${inputs.ttscVersion}\n`);
  hash.update(`tsgo=${inputs.tsgoVersion}\n`);
  hash.update(`platform=${process.platform}/${process.arch}\n`);
  hash.update(`entry=${inputs.entry}\n`);
  if (inputs.goBinary !== undefined) {
    hash.update(`go=${resolveGoCompilerIdentity(inputs.goBinary)}\n`);
  }
  hashGoBuildEnvironment(hash, inputs.goBinary, inputs.dir);
  hashExternalGoBuildEnvironment(hash);
  hashSourceDirectory(hash, "plugin", inputs.dir);
  for (const [index, dir] of [...(inputs.overlayDirs ?? [])].sort().entries()) {
    hashSourceDirectory(hash, `overlay:${index}`, dir);
  }
  // Hash contributors in sorted-by-name order so two consumers with the
  // same logical set produce the same key regardless of declaration order
  // in the host's plugin descriptor.
  const sortedContributors = [...(inputs.contributors ?? [])].sort((a, b) =>
    a.name === b.name ? 0 : a.name < b.name ? -1 : 1,
  );
  for (const contributor of sortedContributors) {
    hashSourceDirectory(
      hash,
      `contributor:${contributor.name}`,
      contributor.source,
    );
  }
  return hash.digest("hex").slice(0, 32);
}

function hashSourceDirectory(
  hash: crypto.Hash,
  label: string,
  root: string,
): void {
  hash.update(`dir=${label}\n`);
  for (const file of collectSourceFiles(root)) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    hash.update(`f=${rel}\n`);
    hash.update(fs.readFileSync(file));
    hash.update("\n");
  }
}

function collectSourceFiles(root: string): string[] {
  const out: string[] = [];
  walk(root, out);
  out.sort();
  return out;
}

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldPruneDirectory(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (shouldOmitSourceFile(entry.name)) continue;
    if (!isHashableFile(entry.name)) continue;
    out.push(full);
  }
}

function shouldPruneDirectory(name: string): boolean {
  return PRUNE_DIRS.has(name);
}

function shouldOmitSourceFile(name: string): boolean {
  if (GENERATED_WORKSPACE_FILES.has(name)) return true;
  // npm-pack tarballs and macOS/Windows editor sidecars are local
  // build artifacts that drift independently of the Go source. They
  // would otherwise enter the cache key and bust the cached binary on
  // every unrelated `npm pack` or editor save.
  if (name.endsWith(".tgz") || name.endsWith(".tar.gz")) return true;
  if (name === ".DS_Store" || name === "Thumbs.db") return true;
  return false;
}

function isHashableFile(name: string): boolean {
  return !name.endsWith("~");
}

function resolveGoCompilerIdentity(goBinary: string): string {
  const resolved = resolveExecutableIdentityPath(goBinary);
  if (!fs.existsSync(resolved)) {
    return "missing";
  }
  const version = spawnSync(goBinary, ["version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const versionText =
    version.error !== undefined
      ? ((version.error as NodeJS.ErrnoException).code ?? version.error.message)
      : `${version.status ?? 0}:${version.stdout}${version.stderr}`;
  const binaryHash = hashFile(resolved);
  return `sha256:${binaryHash}:${versionText}`;
}

function resolveExecutableIdentityPath(binary: string): string {
  if (path.isAbsolute(binary)) {
    return resolveRealPath(binary);
  }
  if (binary.includes(path.sep)) {
    return resolveRealPath(path.resolve(binary));
  }
  for (const dir of readPathEnvironment().split(path.delimiter)) {
    if (dir.length === 0) continue;
    const candidate = path.join(dir, binary);
    if (fs.existsSync(candidate)) {
      return resolveRealPath(candidate);
    }
    if (process.platform === "win32") {
      const executable = `${candidate}.exe`;
      if (fs.existsSync(executable)) {
        return resolveRealPath(executable);
      }
    }
  }
  return binary;
}

function readPathEnvironment(): string {
  return process.env.PATH ?? process.env.Path ?? "";
}

function resolveRealPath(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}

function hashFile(file: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

function hashGoBuildEnvironment(
  hash: crypto.Hash,
  goBinary: string | undefined,
  cwd: string,
): void {
  const values = resolveGoBuildEnvironment(goBinary, cwd);
  for (const key of GO_BUILD_ENV_KEYS) {
    const value = values.get(key);
    if (value !== undefined && value !== "") {
      hash.update(`${key}=${value}\n`);
    }
  }
}

function resolveGoBuildEnvironment(
  goBinary: string | undefined,
  cwd: string,
): Map<string, string> {
  const values = new Map<string, string>();
  if (goBinary !== undefined) {
    const result = spawnSync(goBinary, ["env", "-json", ...GO_BUILD_ENV_KEYS], {
      cwd,
      encoding: "utf8",
      env: goBuildEnv(goBinary),
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    if (result.error === undefined && result.status === 0) {
      try {
        const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
        for (const key of GO_BUILD_ENV_KEYS) {
          const raw = parsed[key];
          if (typeof raw === "string" && raw !== "") {
            values.set(key, normalizeGoBuildEnvValue(key, raw));
          }
        }
      } catch {
        // Fall back to process.env below; a cache key is still better than
        // failing before `go build` can produce the actionable error.
      }
    }
  }
  for (const key of GO_BUILD_ENV_KEYS) {
    if (values.has(key)) continue;
    const value = process.env[key];
    if (value !== undefined && value !== "") {
      values.set(key, normalizeGoBuildEnvValue(key, value));
    }
  }
  return values;
}

function normalizeGoBuildEnvValue(key: string, value: string): string {
  if (key === "GOROOT") {
    return resolveGoRootCacheIdentity(value);
  }
  if (GO_BUILD_COMMAND_ENV_KEYS.has(key)) {
    return `${value}\0${resolveCommandCacheIdentity(value)}`;
  }
  return value;
}

function resolveCommandCacheIdentity(command: string): string {
  const executable = firstCommandToken(command);
  if (executable === null) {
    return "command:empty";
  }
  const resolved = resolveExecutableIdentityPath(executable);
  if (!fs.existsSync(resolved)) {
    return `command:missing:${executable}`;
  }
  try {
    return `command:sha256:${hashFile(resolved)}`;
  } catch {
    return `command:unreadable:${resolved}`;
  }
}

function firstCommandToken(command: string): string | null {
  const trimmed = command.trim();
  if (trimmed === "") {
    return null;
  }
  const quote = trimmed[0];
  if (quote === "'" || quote === '"') {
    const end = trimmed.indexOf(quote, 1);
    return end === -1 ? trimmed.slice(1) : trimmed.slice(1, end);
  }
  return trimmed.split(/\s+/)[0] ?? null;
}

function hashExternalGoBuildEnvironment(hash: crypto.Hash): void {
  for (const key of EXTERNAL_GO_BUILD_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined && value !== "") {
      hash.update(`${key}=${value}\n`);
    }
  }
}

function resolveGoRootCacheIdentity(goRoot: string): string {
  const resolved = resolveRealPath(goRoot);
  if (!fs.existsSync(resolved)) {
    return `missing:${goRoot}`;
  }
  const hash = crypto.createHash("sha256");
  for (const file of collectGoRootIdentityFiles(resolved)) {
    const relative = path.relative(resolved, file).replace(/\\/g, "/");
    hash.update(`f=${relative}\n`);
    hash.update(fs.readFileSync(file));
    hash.update("\n");
  }
  return `sha256:${hash.digest("hex")}`;
}

function collectGoRootIdentityFiles(root: string): string[] {
  const out: string[] = [];
  walkGoRootIdentity(root, root, out);
  out.sort();
  return out;
}

function walkGoRootIdentity(root: string, dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (shouldHashGoRootPath(rel, true)) {
        walkGoRootIdentity(root, file, out);
      }
    } else if (entry.isFile() && shouldHashGoRootPath(rel, false)) {
      out.push(file);
    }
  }
}

function shouldHashGoRootPath(rel: string, isDir: boolean): boolean {
  if (rel === "") return true;
  const parts = rel.split("/");
  if (parts.includes(".git") || parts.includes("testdata")) return false;
  if (!isDir && rel.endsWith("_test.go")) return false;

  const first = parts[0]!;
  if (parts.length === 1) {
    if (isDir) return ["bin", "pkg", "src", "lib"].includes(first);
    return ["VERSION", "go.env"].includes(first);
  }
  if (first === "bin") {
    if (isDir) return true;
    const base = path.basename(rel);
    return (
      base === "go" ||
      base === "go.exe" ||
      base === "gofmt" ||
      base === "gofmt.exe"
    );
  }
  if (first === "pkg") {
    const second = parts[1]!;
    return second === "tool" || second === "include";
  }
  if (first === "src") {
    if (!isDir && parts.length === 2) {
      return ["go.mod", "go.sum"].includes(parts[1]!);
    }
    return parts[1] !== "cmd";
  }
  if (first === "lib") {
    return parts[1] === "time";
  }
  return false;
}

function touchCacheEntry(cacheDir: string): void {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, CACHE_LAST_USED_FILE),
      `${Date.now()}\n`,
    );
  } catch {
    // Cache hits must not fail because metadata touch failed.
  }
}

function maybePruneGlobalPluginCache(root: string): void {
  try {
    fs.mkdirSync(root, { recursive: true });
    const marker = path.join(root, CACHE_GC_MARKER_FILE);
    const now = Date.now();
    const lastRun = readTimestamp(marker);
    if (lastRun !== null && now - lastRun < GLOBAL_CACHE_GC_INTERVAL_MS) {
      return;
    }
    fs.writeFileSync(marker, `${now}\n`);
    pruneGlobalPluginCache(root, now);
  } catch {
    // Global cache GC is opportunistic; builds still proceed when it fails.
  }
}

function pruneGlobalPluginCache(root: string, now: number): void {
  const entries = collectGlobalCacheEntries(root, now);
  for (const entry of entries) {
    if (now - entry.lastUsedAt <= GLOBAL_CACHE_ENTRY_MAX_AGE_MS) {
      continue;
    }
    removeCacheEntry(entry);
  }

  const remaining = collectGlobalCacheEntries(root, now);
  let total = remaining.reduce((sum, entry) => sum + entry.size, 0);
  if (total <= GLOBAL_CACHE_MAX_BYTES) {
    return;
  }
  for (const entry of remaining.sort((a, b) => a.lastUsedAt - b.lastUsedAt)) {
    if (total <= GLOBAL_CACHE_TARGET_BYTES) {
      return;
    }
    if (now - entry.lastUsedAt <= GLOBAL_CACHE_PROTECTED_AGE_MS) {
      continue;
    }
    removeCacheEntry(entry);
    total -= entry.size;
  }
}

interface GlobalCacheEntry {
  dir: string;
  lastUsedAt: number;
  size: number;
}

function collectGlobalCacheEntries(
  root: string,
  now: number,
): GlobalCacheEntry[] {
  const entries: GlobalCacheEntry[] = [];
  let dirents: fs.Dirent[];
  try {
    dirents = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return entries;
  }
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) {
      continue;
    }
    const dir = path.join(root, dirent.name);
    const lastUsedAt = readCacheEntryLastUsedAt(dir, now);
    entries.push({
      dir,
      lastUsedAt,
      size: directorySize(dir),
    });
  }
  return entries;
}

function readCacheEntryLastUsedAt(dir: string, now: number): number {
  const touched = readTimestamp(path.join(dir, CACHE_LAST_USED_FILE));
  if (touched !== null) {
    return touched;
  }
  for (const name of ["plugin", "plugin.exe"]) {
    try {
      return fs.statSync(path.join(dir, name)).mtimeMs;
    } catch {}
  }
  try {
    return fs.statSync(dir).mtimeMs;
  } catch {
    return now;
  }
}

function readTimestamp(file: string): number | null {
  try {
    const text = fs.readFileSync(file, "utf8").trim();
    const value = Number(text);
    if (Number.isFinite(value)) {
      return value;
    }
  } catch {}
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

function directorySize(dir: string): number {
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return total;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        total += directorySize(file);
      } else if (entry.isFile()) {
        total += fs.statSync(file).size;
      }
    } catch {}
  }
  return total;
}

function removeCacheEntry(entry: GlobalCacheEntry): void {
  try {
    fs.rmSync(entry.dir, { recursive: true, force: true });
  } catch {
    // Windows may reject removal while a plugin binary is still running.
  }
}
