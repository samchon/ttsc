import { spawnSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

const GO_MOD_SEARCH_MAX_DEPTH = 3;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "vendor",
  "lib",
]);

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
  const key = computeCacheKey({
    dir,
    entry,
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

  const scratchDir = path.join(
    root,
    `scratch-${key}-${process.pid}-${Date.now()}`,
  );
  try {
    materializeScratchDir(dir, scratchDir);
    writeGoWork(scratchDir, opts.overlayDirs ?? findTtscOverlayDirs());
    const scratchBinaryName =
      process.platform === "win32" ? ".ttsc-plugin.exe" : ".ttsc-plugin";
    runGoBuild(scratchDir, entry, scratchBinaryName, opts.pluginName);
    const builtBinary = path.join(scratchDir, scratchBinaryName);
    fs.renameSync(builtBinary, binaryPath);
    if (process.platform !== "win32") {
      fs.chmodSync(binaryPath, 0o755);
    }
    return binaryPath;
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true });
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
      if (SKIP_DIRS.has(base)) return false;
      if (base === "go.work" || base === "go.work.sum") return false;
      return true;
    },
  });
}

function writeGoWork(scratchDir: string, useDirs: readonly string[]): void {
  const useLines = ["\t."];
  for (const dir of useDirs) {
    useLines.push(`\t${dir.replace(/\\/g, "/")}`);
  }
  const replaceLines = sourceBuildWorkspaceReplacements(useDirs);
  const replaceBlock =
    replaceLines.length === 0 ? "" : `\n\n${replaceLines.join("\n")}\n`;
  const goWork = `go 1.26\n\nuse (\n${useLines.join("\n")}\n)${replaceBlock}`;
  fs.writeFileSync(path.join(scratchDir, "go.work"), goWork, "utf8");
}

function sourceBuildWorkspaceReplacements(
  useDirs: readonly string[],
): string[] {
  const ttscRoot = useDirs.find((dir) =>
    hasModulePath(dir, "github.com/samchon/ttsc/packages/ttsc"),
  );
  if (!ttscRoot) {
    return [];
  }
  return [
    `replace github.com/samchon/ttsc/packages/ttsc v0.0.0 => ${ttscRoot.replace(/\\/g, "/")}`,
  ];
}

function hasModulePath(dir: string, modulePath: string): boolean {
  try {
    const goMod = fs.readFileSync(path.join(dir, "go.mod"), "utf8");
    return new RegExp(`^module\\s+${escapeRegExp(modulePath)}\\s*$`, "m").test(
      goMod,
    );
  } catch {
    return false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function runGoBuild(
  cwd: string,
  entry: string,
  binaryName: string,
  pluginName: string,
): void {
  const goBinary = resolveGoCompiler();
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
      throw new Error(
        `ttsc: building plugin "${pluginName}" failed because the Go toolchain was not found. ` +
          `Reinstall ttsc with optional dependencies so the bundled Go compiler is present, ` +
          `or set TTSC_GO_BINARY to an absolute path.`,
      );
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
    if (SKIP_DIRS.has(entry.name)) continue;
    walkForGoMod(path.join(dir, entry.name), out);
  }
}

function resolvePluginCacheRoot(
  projectRoot: string,
  cacheDir?: string,
): string {
  if (cacheDir) {
    return path.resolve(cacheDir, "plugins");
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

  return "go";
}

function computeCacheKey(inputs: {
  dir: string;
  entry: string;
  ttscVersion: string;
  tsgoVersion: string;
}): string {
  const hash = crypto.createHash("sha256");
  hash.update(`ttsc=${inputs.ttscVersion}\n`);
  hash.update(`tsgo=${inputs.tsgoVersion}\n`);
  hash.update(`platform=${process.platform}/${process.arch}\n`);
  hash.update(`entry=${inputs.entry}\n`);
  for (const file of collectSourceFiles(inputs.dir)) {
    const rel = path.relative(inputs.dir, file).replace(/\\/g, "/");
    hash.update(`f=${rel}\n`);
    hash.update(fs.readFileSync(file));
  }
  return hash.digest("hex").slice(0, 32);
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
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!isHashableFile(entry.name)) continue;
    out.push(full);
  }
}

function isHashableFile(name: string): boolean {
  if (name === "go.mod" || name === "go.sum" || name === "go.work") return true;
  return /\.(?:go|s|c|h|cpp|hpp)$/i.test(name);
}
