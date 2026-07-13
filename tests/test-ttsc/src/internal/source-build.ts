/**
 * Shared helpers for tests that exercise the source-plugin build pipeline
 * (`buildSourcePlugin`, `computeCacheKey`, `resolvePluginCacheRoot`,
 * `resolveSourceBuildCachePaths`). Provides a cross-platform fake `go`
 * executable that satisfies the commands ttsc issues during plugin compilation
 * without running a real Go toolchain.
 */
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  autoQuoteGoModToken,
  buildSourcePlugin,
  computeCacheKey,
  formatDuration,
  formatGoWorkPath,
  inspectPluginBuildLock,
  resolvePluginCacheRoot,
  resolveSourceBuildCachePaths,
  waitForPluginBinary,
} from "../../../../packages/ttsc/lib/plugin/internal/buildSourcePlugin.js";

/**
 * Writes a fake `go` executable (Node.js script) into `root` and returns its
 * path. The script handles `go version`, `go env -json`, `go mod edit -json`,
 * and `go build`, verifying that expected copied source files are present
 * before writing a stub binary to the `-o` output path.
 *
 * On Windows the wrapper is a `.cmd` batch file; on POSIX it is a shell script.
 * Pass `{ executable: false }` to produce a non-executable POSIX file, which
 * lets tests verify that `buildSourcePlugin` fixes permissions before running
 * the toolchain.
 *
 * Environment hooks let lock-coordination tests sequence concurrent builders
 * with explicit barriers instead of sleeps:
 *
 * - `FAKE_GO_INVOCATION_LOG`: append each invocation's arguments as one line to
 *   this file.
 * - `FAKE_GO_BUILD_BARRIER_FILE`: write this file when `go build` starts, so an
 *   orchestrator can observe that the builder holds the lock and is inside its
 *   build.
 * - `FAKE_GO_BUILD_RELEASE_FILE`: block `go build` until this file exists
 *   (bounded by a two-minute safety deadline).
 * - `FAKE_GO_BUILD_EXIT_CODE`: exit `go build` with this status instead of
 *   writing the output binary, simulating a failed compile.
 */
function createFakeGoBinary(
  root: string,
  opts: { executable?: boolean } = {},
): string {
  const script = path.join(root, "fake-go.cjs");
  fs.writeFileSync(
    script,
    [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      "const args = process.argv.slice(2);",
      "if (process.env.FAKE_GO_INVOCATION_LOG) {",
      "  fs.appendFileSync(",
      "    process.env.FAKE_GO_INVOCATION_LOG,",
      '    args.join(" ") + "\\n",',
      '    "utf8",',
      "  );",
      "}",
      'if (args[0] === "version") {',
      '  console.log("go version fake");',
      "  process.exit(0);",
      "}",
      'if (args[0] === "env" && args[1] === "-json") {',
      "  const out = {};",
      "  for (const key of args.slice(2)) {",
      "    const fake = process.env[`FAKE_GO_ENV_${key}`];",
      "    const value = fake === undefined ? process.env[key] : fake;",
      "    if (value !== undefined) out[key] = value;",
      "  }",
      "  console.log(JSON.stringify(out));",
      "  process.exit(0);",
      "}",
      'if (args[0] === "mod" && args[1] === "edit" && args[2] === "-json") {',
      '  const goMod = fs.readFileSync(path.join(process.cwd(), "go.mod"), "utf8");',
      "  console.log(JSON.stringify(parseGoMod(goMod)));",
      "  process.exit(0);",
      "}",
      'if (args[0] !== "build") {',
      '  console.error(`unexpected go command: ${args.join(" ")}`);',
      "  process.exit(1);",
      "}",
      "if (process.env.FAKE_GO_BUILD_BARRIER_FILE) {",
      "  fs.writeFileSync(",
      "    process.env.FAKE_GO_BUILD_BARRIER_FILE,",
      '    "building\\n",',
      '    "utf8",',
      "  );",
      "}",
      "if (process.env.FAKE_GO_BUILD_RELEASE_FILE) {",
      "  const releaseDeadline = Date.now() + 120000;",
      "  while (!fs.existsSync(process.env.FAKE_GO_BUILD_RELEASE_FILE)) {",
      "    if (Date.now() > releaseDeadline) {",
      '      console.error("fake go: FAKE_GO_BUILD_RELEASE_FILE never appeared");',
      "      process.exit(1);",
      "    }",
      "    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);",
      "  }",
      "}",
      "if (process.env.FAKE_GO_BUILD_EXIT_CODE) {",
      '  console.error("fake go: build failed as directed by FAKE_GO_BUILD_EXIT_CODE");',
      "  process.exit(Number(process.env.FAKE_GO_BUILD_EXIT_CODE));",
      "}",
      "const required = [",
      '  "vendor/local/value.go",',
      '  "lib/helper.go",',
      '  "dist/generated.go",',
      '  "build/generated.go",',
      "];",
      "const missing = required.filter((file) =>",
      "  !fs.existsSync(path.join(process.cwd(), file)),",
      ");",
      "if (missing.length > 0) {",
      '  console.error(`missing copied source files: ${missing.join(", ")}`);',
      "  process.exit(1);",
      "}",
      'const outIndex = args.indexOf("-o");',
      "const out = outIndex >= 0 ? args[outIndex + 1] : null;",
      "if (!out) {",
      '  console.error("missing -o output path");',
      "  process.exit(1);",
      "}",
      "if (process.env.FAKE_GO_CAPTURE_ENV_FILE) {",
      "  fs.writeFileSync(",
      "    process.env.FAKE_GO_CAPTURE_ENV_FILE,",
      "    JSON.stringify({ GOCACHE: process.env.GOCACHE ?? null }),",
      "    'utf8',",
      "  );",
      "}",
      "fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });",
      'fs.writeFileSync(out, "fake plugin binary\\n", "utf8");',
      "process.exit(0);",
      "",
      "function parseGoMod(text) {",
      "  const out = {};",
      "  let block = null;",
      "  for (const raw of text.split(/\\r?\\n/)) {",
      "    const line = raw.replace(/\\/\\/.*$/, '').trim();",
      "    if (!line) continue;",
      "    if (line === ')') { block = null; continue; }",
      "    if (line === 'replace (') { block = 'replace'; continue; }",
      "    if (line.startsWith('module ')) out.Module = { Path: line.split(/\\s+/)[1] };",
      "    else if (line.startsWith('replace ')) addReplace(out, line.slice('replace '.length));",
      "    else if (block === 'replace') addReplace(out, line);",
      "  }",
      "  return out;",
      "}",
      "function addReplace(out, line) {",
      "  const fields = line.trim().split(/\\s+/);",
      "  const arrow = fields.indexOf('=>');",
      "  if (arrow < 1 || fields.length <= arrow + 1) return;",
      "  const old = { Path: fields[0] };",
      "  if (fields[1] && fields[1] !== '=>') old.Version = fields[1];",
      "  (out.Replace ??= []).push({ Old: old, New: { Path: fields[arrow + 1] } });",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  if (process.platform === "win32") {
    const command = path.join(root, "fake-go.cmd");
    fs.writeFileSync(
      command,
      `@echo off\r\n"${process.execPath}" "%~dp0fake-go.cjs" %*\r\n`,
      "utf8",
    );
    return command;
  }

  const command = path.join(root, "fake-go");
  fs.writeFileSync(
    command,
    `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(script)} "$@"\n`,
    "utf8",
  );
  fs.chmodSync(command, opts.executable === false ? 0o644 : 0o755);
  return command;
}

/**
 * Single-quotes a shell argument, escaping any embedded single quotes with the
 * `'\''` idiom. Used when embedding Node.js executable paths into POSIX shell
 * wrapper scripts.
 */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/** Captured output of one `buildSourcePlugin` child-process worker. */
interface ISourcePluginWorkerResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Writes a CommonJS runner script that calls the workspace-built
 * `buildSourcePlugin` with the given fixed inputs and returns the script's
 * path. Lock-coordination tests spawn this script as a real holder and a real
 * waiter process for the same cache key; per-role behavior is injected only
 * through the `FAKE_GO_BUILD_*` environment hooks of `createFakeGoBinary`.
 *
 * The runner prints the built (or reused) binary path on stdout and exits 0; a
 * build failure prints the error message on stderr and exits 1.
 */
function createSourcePluginWorkerScript(opts: {
  cacheDir: string;
  pluginName: string;
  root: string;
  source: string;
}): string {
  const libraryPath = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "lib",
    "plugin",
    "internal",
    "buildSourcePlugin.js",
  );
  const script = path.join(opts.root, "build-source-plugin-worker.cjs");
  fs.writeFileSync(
    script,
    [
      `const { buildSourcePlugin } = require(${JSON.stringify(libraryPath)});`,
      "try {",
      "  const binary = buildSourcePlugin({",
      `    baseDir: ${JSON.stringify(opts.root)},`,
      `    cacheDir: ${JSON.stringify(opts.cacheDir)},`,
      "    overlayDirs: [],",
      `    pluginName: ${JSON.stringify(opts.pluginName)},`,
      "    quiet: false,",
      `    source: ${JSON.stringify(opts.source)},`,
      '    ttscVersion: "1.0.0",',
      '    tsgoVersion: "7.0.0-dev",',
      "  });",
      '  process.stdout.write(binary + "\\n");',
      "} catch (error) {",
      "  process.stderr.write(",
      '    String((error && error.message) || error) + "\\n",',
      "  );",
      "  process.exitCode = 1;",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  return script;
}

/**
 * Spawns one `buildSourcePlugin` worker (see
 * {@link createSourcePluginWorkerScript}) and resolves when it exits. `env`
 * entries overlay the inherited environment — pass the `FAKE_GO_BUILD_*` hooks
 * there to script the worker's fake toolchain. A two-minute kill timeout bounds
 * a wedged worker so a broken lock never hangs the suite.
 */
function spawnSourcePluginWorker(opts: {
  env?: Record<string, string>;
  goBinary: string;
  script: string;
}): Promise<ISourcePluginWorkerResult> {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(process.execPath, [opts.script], {
      env: {
        ...process.env,
        TTSC_GO_BINARY: opts.goBinary,
        ...opts.env,
      },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

/**
 * Polls `predicate` every 25 ms until it holds, failing with `description`
 * after `timeoutMs` (default one minute). This is observation of an explicit
 * barrier another process definitely produces, not a timing assumption: the
 * caller's correctness never depends on how long the wait took.
 */
async function waitForCondition(
  predicate: () => boolean,
  description: string,
  timeoutMs = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${description}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

export {
  assert,
  autoQuoteGoModToken,
  buildSourcePlugin,
  child_process,
  computeCacheKey,
  createFakeGoBinary,
  createSourcePluginWorkerScript,
  formatDuration,
  formatGoWorkPath,
  fs,
  inspectPluginBuildLock,
  os,
  path,
  resolvePluginCacheRoot,
  resolveSourceBuildCachePaths,
  shellQuote,
  spawnSourcePluginWorker,
  waitForCondition,
  waitForPluginBinary,
};
