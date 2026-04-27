import { spawnSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { TtscNativeSource } from "./native";

export interface BuildSourcePluginOptions {
  source: TtscNativeSource;
  pluginName: string;
  baseDir: string;
  ttscVersion: string;
  tsgoVersion: string;
}

export function buildSourcePlugin(opts: BuildSourcePluginOptions): string {
  const dir = path.isAbsolute(opts.source.dir)
    ? opts.source.dir
    : path.resolve(opts.baseDir, opts.source.dir);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(
      `ttsc: plugin "${opts.pluginName}" native.source.dir does not exist: ${dir}`,
    );
  }
  const entry = opts.source.entry ?? ".";
  const key = computeCacheKey({
    dir,
    entry,
    ttscVersion: opts.ttscVersion,
    tsgoVersion: opts.tsgoVersion,
  });
  const cacheDir = path.join(cacheRoot(), key);
  const binaryName = process.platform === "win32" ? "plugin.exe" : "plugin";
  const binaryPath = path.join(cacheDir, binaryName);
  if (fs.existsSync(binaryPath)) {
    return binaryPath;
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  process.stderr.write(
    `ttsc: building source plugin "${opts.pluginName}" from ${dir} (this runs once per cache key)\n`,
  );

  const scratchDir = path.join(
    cacheRoot(),
    `scratch-${key}-${process.pid}-${Date.now()}`,
  );
  try {
    materializeScratchDir(dir, scratchDir);
    writeGoWork(scratchDir, findTtscOverlayDirs());
    runGoBuild(scratchDir, entry, binaryName, opts.pluginName);
    const builtBinary = path.join(scratchDir, binaryName);
    fs.renameSync(builtBinary, binaryPath);
    if (process.platform !== "win32") {
      fs.chmodSync(binaryPath, 0o755);
    }
    return binaryPath;
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true });
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
  const goWork = `go 1.26\n\nuse (\n${useLines.join("\n")}\n)\n`;
  fs.writeFileSync(path.join(scratchDir, "go.work"), goWork, "utf8");
}

function runGoBuild(
  cwd: string,
  entry: string,
  binaryName: string,
  pluginName: string,
): void {
  const goBinary = resolveGoBinary();
  const result = spawnSync(
    goBinary,
    ["build", "-o", binaryName, entry],
    {
      cwd,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 1024 * 1024 * 64,
      windowsHide: true,
    },
  );
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `ttsc: building plugin "${pluginName}" failed because the Go toolchain was not found. ` +
          `Install Go (https://go.dev/dl/) or set TTSC_GO_BINARY to an absolute path.`,
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

let cachedOverlayDirs: readonly string[] | null = null;

function findTtscOverlayDirs(): readonly string[] {
  if (cachedOverlayDirs !== null) {
    return cachedOverlayDirs;
  }
  const ttscRoot = path.resolve(__dirname, "..");
  const dirs: string[] = [];
  if (fs.existsSync(path.join(ttscRoot, "go.mod"))) {
    dirs.push(ttscRoot);
  }
  const shimRoot = path.join(ttscRoot, "shim");
  if (fs.existsSync(shimRoot)) {
    walkForGoMod(shimRoot, dirs);
  }
  dirs.sort();
  cachedOverlayDirs = dirs;
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

function cacheRoot(): string {
  if (process.env.TTSC_CACHE_DIR) {
    return path.resolve(process.env.TTSC_CACHE_DIR, "plugins");
  }
  const xdg = process.env.XDG_CACHE_HOME;
  if (xdg) return path.join(xdg, "ttsc", "plugins");
  return path.join(os.homedir(), ".cache", "ttsc", "plugins");
}

function resolveGoBinary(): string {
  const explicit = process.env.TTSC_GO_BINARY;
  if (explicit && explicit.length > 0) return explicit;
  return "go";
}

interface KeyInputs {
  dir: string;
  entry: string;
  ttscVersion: string;
  tsgoVersion: string;
}

export function computeCacheKey(inputs: KeyInputs): string {
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

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "vendor",
  "lib",
]);

function collectSourceFiles(root: string): string[] {
  const out: string[] = [];
  walk(root, root, out);
  out.sort();
  return out;
}

function walk(root: string, dir: string, out: string[]): void {
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
      walk(root, full, out);
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
