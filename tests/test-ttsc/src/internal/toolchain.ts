/**
 * Shared helpers for tests that drive the ttsc and ttsx launchers directly,
 * bypassing `@ttsc/testing` so the test can control binary override environment
 * variables (`TTSC_BINARY`, `TTSC_TSGO_BINARY`). Provides `spawn` (with
 * overrides injected), `spawnWithoutTsgoOverride` (for consumer-local tsgo
 * tests), `createFakeNativePreview` (a scripted tsgo stub installed in a temp
 * project's `node_modules`), and workspace path constants.
 */
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const workspaceRoot = findWorkspaceRoot(process.cwd());
const requireFromTest = createRequire(path.join(workspaceRoot, "package.json"));
const __dirname = path.join(
  workspaceRoot,
  "tests",
  "test-ttsc",
  "src",
  "internal",
);
const ttscBin = path.join(
  workspaceRoot,
  "packages",
  "ttsc",
  "lib",
  "launcher",
  "ttsc.js",
);
const ttsxBin = path.join(
  workspaceRoot,
  "packages",
  "ttsc",
  "lib",
  "launcher",
  "ttsx.js",
);
const nativeBinary = path.join(
  workspaceRoot,
  "packages",
  `ttsc-${process.platform}-${process.arch}`,
  "bin",
  process.platform === "win32" ? "ttsc.exe" : "ttsc",
);
const tsgoBinary = resolveTsgoBinary();

/** Creates a temp project directory and writes `files` into it. */
function createProject(files: Record<string, string>) {
  const root = TestProject.tmpdir("ttsc-smoke-");
  for (const [name, contents] of Object.entries(files) as [string, string][]) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, "utf8");
  }
  return root;
}

/**
 * Spawns a command synchronously with `TTSC_BINARY` and `TTSC_TSGO_BINARY` set
 * to the workspace-built binaries, ensuring tests run against the current build
 * rather than any globally installed version.
 */
function spawn(command: string, args: string[], options: any = {}) {
  const usesNodeLauncher = command === ttscBin || command === ttsxBin;
  const result = child_process.spawnSync(
    usesNodeLauncher ? process.execPath : command,
    [...(usesNodeLauncher ? [command] : []), ...args],
    {
      ...options,
      env: {
        ...process.env,
        TTSC_BINARY: nativeBinary,
        TTSC_TSGO_BINARY: tsgoBinary,
      },
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
      windowsHide: true,
    },
  );
  if (result.error && !result.stderr) {
    result.stderr = result.error.message;
  }
  return result;
}

/**
 * Like `spawn` but strips `TTSC_BINARY` and `TTSC_TSGO_BINARY` from the
 * environment, letting the launcher resolve the consumer-local
 * `@typescript/native-preview` tsgo binary. Used by tests that verify ttsx
 * calls the project-installed tsgo rather than the workspace binary.
 */
function spawnWithoutTsgoOverride(
  command: string,
  args: string[],
  options: any = {},
) {
  const usesNodeLauncher = command === ttscBin || command === ttsxBin;
  const env = { ...process.env };
  delete env.TTSC_BINARY;
  delete env.TTSC_TSGO_BINARY;
  const result = child_process.spawnSync(
    usesNodeLauncher ? process.execPath : command,
    [...(usesNodeLauncher ? [command] : []), ...args],
    {
      ...options,
      env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
      windowsHide: true,
    },
  );
  if (result.error && !result.stderr) {
    result.stderr = result.error.message;
  }
  return result;
}

/**
 * Installs a fake `@typescript/native-preview` (and its platform sub-package)
 * into `root/node_modules`. The tsgo binary stub runs `scriptBody` as Node.js
 * source, with `fs` and `path` pre-imported, so callers can script emit
 * behavior, capture arguments, or simulate version output without a real Go
 * toolchain.
 */
function createFakeNativePreview(root: string, scriptBody: string) {
  const nativeRoot = path.join(
    root,
    "node_modules",
    "@typescript",
    "native-preview",
  );
  const platformRoot = path.join(
    root,
    "node_modules",
    "@typescript",
    `native-preview-${process.platform}-${process.arch}`,
  );
  fs.mkdirSync(nativeRoot, { recursive: true });
  fs.mkdirSync(path.join(platformRoot, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(nativeRoot, "package.json"),
    JSON.stringify({
      name: "@typescript/native-preview",
      version: "7.0.0-dev.CONSUMER-SMOKE",
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(platformRoot, "package.json"),
    JSON.stringify({
      name: `@typescript/native-preview-${process.platform}-${process.arch}`,
      version: "7.0.0-dev.CONSUMER-SMOKE",
    }),
    "utf8",
  );
  const tsgo = path.join(
    platformRoot,
    "lib",
    process.platform === "win32" ? "tsgo.exe" : "tsgo",
  );
  fs.writeFileSync(
    tsgo,
    `#!/usr/bin/env node\nconst fs = require("node:fs");\nconst path = require("node:path");\n${scriptBody}\n`,
    "utf8",
  );
  fs.chmodSync(tsgo, 0o755);
}

/**
 * Resolves the absolute path to the `tsgo` binary shipped by the workspace's
 * `@typescript/native-preview` install. Uses `createRequire` so the resolution
 * follows the same package-graph path the launcher takes at runtime.
 */
function resolveTsgoBinary() {
  const packageJson = requireFromTest.resolve(
    "@typescript/native-preview/package.json",
    {
      paths: [workspaceRoot],
    },
  );
  const requireFromNativePreview = createRequire(packageJson);
  const platformPackageJson = requireFromNativePreview.resolve(
    `@typescript/native-preview-${process.platform}-${process.arch}/package.json`,
  );
  return path.join(
    path.dirname(platformPackageJson),
    "lib",
    process.platform === "win32" ? "tsgo.exe" : "tsgo",
  );
}

/**
 * Walks up from `start` until a directory containing `pnpm-workspace.yaml` is
 * found. Throws if no workspace root is found before reaching the filesystem
 * root.
 */
function findWorkspaceRoot(start: string): string {
  let dir = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Unable to find workspace root from ${start}`);
    }
    dir = parent;
  }
}

export {
  __dirname,
  assert,
  child_process,
  createFakeNativePreview,
  createProject,
  createRequire,
  fs,
  nativeBinary,
  os,
  path,
  requireFromTest,
  resolveTsgoBinary,
  spawn,
  spawnWithoutTsgoOverride,
  tsgoBinary,
  ttscBin,
  ttsxBin,
  workspaceRoot,
};
