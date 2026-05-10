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

/** Build one Go source plugin into a cached executable. */
export function buildSourcePlugin(opts: {
  source: string;
  pluginName: string;
  baseDir: string;
  cacheDir?: string;
  label?: string;
  overlayDirs?: readonly string[];
  quiet?: boolean;
  ttscVersion: string;
  tsgoVersion: string;
}): string {
  const { dir, entry, source } = resolveSourceBuildTarget(opts);
  const overlayDirs = opts.overlayDirs ?? findTtscOverlayDirs();
  const goBinary = resolveGoCompiler();
  ensureExecutableGoToolchain(goBinary);
  const key = computeCacheKey({
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
    return binaryPath;
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  const label = opts.label ?? "source plugin";
  if (opts.quiet !== true) {
    process.stderr.write(
      `ttsc: building ${label} "${opts.pluginName}" from ${source} (this runs once per cache key)\n`,
    );
  }

  const scratchDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `ttsc-plugin-${key}-`),
  );
  try {
    materializeScratchDir(dir, scratchDir);
    writeGoWork(scratchDir, overlayDirs, goBinary, opts.pluginName);
    const scratchBinaryName =
      process.platform === "win32" ? ".ttsc-plugin.exe" : ".ttsc-plugin";
    runGoBuild(scratchDir, entry, scratchBinaryName, opts.pluginName, goBinary);
    const builtBinary = path.join(scratchDir, scratchBinaryName);
    publishBuiltBinary(builtBinary, binaryPath);
    return binaryPath;
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }
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
  validateSourceReplacements(
    scratchDir,
    useDirs,
    goModReader,
    pluginName,
  );
  const useLines = ["\t."];
  for (const dir of useDirs) {
    useLines.push(`\t${dir.replace(/\\/g, "/")}`);
  }
  const replaceLines = sourceBuildWorkspaceReplacements(
    useDirs,
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

function resolvePluginCacheRoot(
  projectRoot: string,
  cacheDir?: string,
): string {
  if (cacheDir) {
    return path.resolve(projectRoot, cacheDir, "plugins");
  }
  if (process.env.TTSC_CACHE_DIR) {
    return path.resolve(process.env.TTSC_CACHE_DIR, "plugins");
  }
  const root = path.resolve(projectRoot);
  const nodeModules = path.join(root, "node_modules");
  if (isDirectory(nodeModules)) {
    return path.join(nodeModules, ".ttsc", "plugins");
  }
  return path.join(root, ".ttsc", "plugins");
}

function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
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
  hashSourceDirectory(hash, "plugin", inputs.dir);
  for (const [index, dir] of [...(inputs.overlayDirs ?? [])].sort().entries()) {
    hashSourceDirectory(hash, `overlay:${index}`, dir);
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
  return GENERATED_WORKSPACE_FILES.has(name);
}

function isHashableFile(name: string): boolean {
  return !name.endsWith("~");
}

function resolveGoCompilerIdentity(goBinary: string): string {
  const resolved = resolveExecutableIdentityPath(goBinary);
  const version = spawnSync(goBinary, ["version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const versionText =
    version.error !== undefined
      ? version.error.message
      : `${version.status ?? 0}:${version.stdout}${version.stderr}`;
  let statText = "";
  try {
    const stat = fs.statSync(resolved);
    statText = `${stat.size}:${stat.mtimeMs}`;
  } catch {
    statText = "missing";
  }
  return `${goBinary}:${resolved}:${statText}:${versionText}`;
}

function resolveExecutableIdentityPath(binary: string): string {
  if (path.isAbsolute(binary)) {
    return resolveRealPath(binary);
  }
  if (binary.includes(path.sep)) {
    return resolveRealPath(path.resolve(binary));
  }
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
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

function resolveRealPath(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}
