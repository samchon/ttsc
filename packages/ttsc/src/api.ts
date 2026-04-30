/**
 * Programmatic API for ttsc.
 *
 * This module is the TypeScript surface bundler adapters (unplugin, vite,
 * webpack, rollup, esbuild, rspack, farm, next/swc, bun) consume. Project
 * builds delegate to the consuming project's `@typescript/native-preview`
 * `tsgo` binary, while plugin-selected native sidecars remain opt-in.
 *
 * Contract:
 *
 * - `transform()` emits one file's rewritten JS, returning the text.
 * - `build()` runs the whole project (tsgo + ttsc rewrite + --emit).
 * - `check()` runs the analysis pass without emitting (CI gate use).
 * - `version()` returns the wrapper and resolved `tsgo` version banner.
 *
 * All helpers accept a `binary` override so tests can point at a specific
 * `tsgo` executable without touching PATH or node_modules.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { ITtscBuildOptions } from "./structures/ITtscBuildOptions";
import type { ITtscBuildResult } from "./structures/ITtscBuildResult";
import type { ITtscCheckOptions } from "./structures/ITtscCheckOptions";
import type { ITtscCommonOptions } from "./structures/ITtscCommonOptions";
import type { ITtscLoadedNativePlugin } from "./structures/ITtscLoadedNativePlugin";
import type { ITtscResolvedTsgo } from "./structures/ITtscResolvedTsgo";
import type { ITtscTransformOptions } from "./structures/ITtscTransformOptions";
import { resolveBinary } from "./platform";
import { loadProjectPlugins } from "./plugin";
import { resolveProjectConfig, resolveProjectRoot } from "./project";
import { resolveTsgo } from "./tsgo";

export type { ITtscBuildOptions } from "./structures/ITtscBuildOptions";
export type { ITtscBuildResult } from "./structures/ITtscBuildResult";
export type { ITtscCheckOptions } from "./structures/ITtscCheckOptions";
export type { ITtscCommonOptions } from "./structures/ITtscCommonOptions";
export type { ITtscTransformOptions } from "./structures/ITtscTransformOptions";

/** Merge spawn env without clobbering unrelated vars. */
function mergeEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const base = {
    ...process.env,
    TTSC_NODE_BINARY: process.env.TTSC_NODE_BINARY ?? process.execPath,
  };
  if (!extra) return base;
  return { ...base, ...extra };
}

function nativePluginEnv(
  extra: NodeJS.ProcessEnv | undefined,
  execution: ITtscExecutionContext,
): NodeJS.ProcessEnv {
  return mergeEnv({
    TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? execution.tsgo.binary,
    TTSC_TTSX_BINARY:
      process.env.TTSC_TTSX_BINARY ?? path.join(__dirname, "launcher", "ttsx.js"),
    ...extra,
  });
}

function spawnBinary(
  binary: string,
  args: readonly string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    encoding?: BufferEncoding;
  },
) {
  const viaNode = shouldSpawnViaNode(binary);
  if (!viaNode) {
    ensureExecutable(binary);
  }
  return spawnSync(
    viaNode ? process.execPath : binary,
    viaNode ? [binary, ...args] : [...args],
    {
      cwd: options.cwd,
      env: options.env,
      encoding: options.encoding,
      maxBuffer: 1024 * 1024 * 256,
      windowsHide: true,
    },
  );
}

function shouldSpawnViaNode(binary: string): boolean {
  return /\.(?:[cm]?js|ts)$/i.test(binary);
}

function ensureExecutable(binary: string): void {
  if (process.platform === "win32") {
    return;
  }
  try {
    const mode = fs.statSync(binary).mode & 0o777;
    if ((mode & 0o111) !== 0) {
      return;
    }
    fs.chmodSync(binary, mode | 0o755);
  } catch {
    /* keep the original spawn error path */
  }
}

function outputText(value: string | Buffer | null | undefined): string {
  if (value == null) {
    return "";
  }
  return typeof value === "string" ? value : value.toString("utf8");
}

function hasCapability(
  plugin: ITtscLoadedNativePlugin,
  capability: string,
): boolean {
  return plugin.backend.capabilities?.includes(capability) === true;
}

function isOutputPlugin(plugin: ITtscLoadedNativePlugin): boolean {
  return hasCapability(plugin, "output");
}

function isCheckOnlyPlugin(plugin: ITtscLoadedNativePlugin): boolean {
  const capabilities = plugin.backend.capabilities ?? [];
  return (
    capabilities.length > 0 &&
    capabilities.every((capability) => capability === "check")
  );
}

function isCompilerPlugin(plugin: ITtscLoadedNativePlugin): boolean {
  return !isOutputPlugin(plugin) && !isCheckOnlyPlugin(plugin);
}

function outputPlugins(
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscLoadedNativePlugin[] {
  return plugins.filter(isOutputPlugin);
}

function checkOnlyPlugins(
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscLoadedNativePlugin[] {
  return plugins.filter(isCheckOnlyPlugin);
}

function compilerPlugins(
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscLoadedNativePlugin[] {
  return plugins.filter(isCompilerPlugin);
}

/**
 * Transform a single .ts file and return the rewritten JS as a string.
 *
 * Intended for bundler per-file transforms (unplugin `transform()`). The caller
 * passes the absolute path; ttsc loads the enclosing tsconfig, compiles with
 * tsgo, and returns the rewritten JS.
 *
 * Throws when the binary exits non-zero — the error includes stderr so bundler
 * error overlays surface the real cause.
 */
export function transform(options: ITtscTransformOptions): string {
  const execution = resolveExecutionContext(options);
  const sourceFile = realpathIfExists(
    path.isAbsolute(options.file)
      ? options.file
      : path.resolve(options.cwd ?? process.cwd(), options.file),
  );
  if (execution.nativePlugins.length > 0) {
    return transformWithNativePlugins(options, execution, sourceFile);
  }

  const tempOutDir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-transform-"));
  try {
    const result = build({
      ...options,
      emit: true,
      outDir: tempOutDir,
      plugins: false,
      tsconfig: execution.tsconfig,
    });
    if (result.status !== 0) {
      throw new Error(
        "ttsc.transform exited " +
          result.status +
          "\n" +
          (result.stderr || result.stdout),
      );
    }
    const emitted = findEmittedFile(tempOutDir, execution.projectRoot, sourceFile);
    if (!emitted) {
      throw new Error(`ttsc.transform: no output produced for ${sourceFile}`);
    }
    const transformed = fs.readFileSync(emitted, "utf8");
    if (options.out) {
      fs.mkdirSync(path.dirname(options.out), { recursive: true });
      fs.writeFileSync(options.out, transformed, "utf8");
    }
    return transformed;
  } finally {
    fs.rmSync(tempOutDir, { recursive: true, force: true });
  }
}

function transformWithNativePlugins(
  options: ITtscTransformOptions,
  execution: ITtscExecutionContext,
  sourceFile: string,
): string {
  const checked = runNativeCheckPlugins(options, execution);
  if (checked.status !== 0) {
    throw new Error(
      "ttsc.transform exited " + checked.status + "\n" + checked.stderr,
    );
  }

  const compilers = compilerPlugins(execution.nativePlugins);
  const outputs = outputPlugins(execution.nativePlugins);
  const tempOutDir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-transform-"));
  try {
    let emitted: string | null = null;
    if (compilers.length !== 0) {
      assertSingleCompilerHost(compilers);
      emitted = path.join(tempOutDir, "transform.js");
      const transformed = runNativeCompilerTransform(
        options,
        execution,
        sourceFile,
        emitted,
        compilers,
      );
      if (transformed.status !== 0) {
        throw new Error(
          "ttsc.transform exited " +
            transformed.status +
            "\n" +
            transformed.stderr,
        );
      }
    } else {
      const result = build({
        ...options,
        emit: true,
        outDir: tempOutDir,
        plugins: false,
        skipDiagnosticsCheck: checkOnlyPlugins(execution.nativePlugins).length !== 0,
        tsconfig: execution.tsconfig,
      });
      if (result.status !== 0) {
        throw new Error(
          "ttsc.transform exited " +
            result.status +
            "\n" +
            (result.stderr || result.stdout),
        );
      }
      emitted = findEmittedFile(tempOutDir, execution.projectRoot, sourceFile);
      if (!emitted) {
        throw new Error(`ttsc.transform: no output produced for ${sourceFile}`);
      }
    }

    for (const plugin of outputs) {
      const result = runNativeOutputPlugin(options, execution, plugin, emitted);
      if (result.status !== 0) {
        throw new Error(
          "ttsc.transform exited " +
            result.status +
            "\n" +
            (result.stderr || result.stdout),
        );
      }
    }

    const transformed = fs.readFileSync(emitted, "utf8");
    if (options.out) {
      fs.mkdirSync(path.dirname(options.out), { recursive: true });
      fs.writeFileSync(options.out, transformed, "utf8");
    }
    return transformed;
  } finally {
    fs.rmSync(tempOutDir, { recursive: true, force: true });
  }
}

function realpathIfExists(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    return file;
  }
}

/**
 * Run `ttsc` against a tsconfig. Returns once the binary exits so the caller
 * can decide how to surface diagnostics. Does not throw on non-zero exit —
 * bundler pipelines often want to continue and collect errors.
 */
export function build(options: ITtscBuildOptions = {}): ITtscBuildResult {
  const execution = resolveExecutionContext(options);
  if (execution.nativePlugins.length > 0) {
    const compilers = compilerPlugins(execution.nativePlugins);
    const outputs = outputPlugins(execution.nativePlugins);
    const checked = runNativeCheckPlugins(options, execution);
    if (checked.status !== 0) {
      return checked;
    }

    if (options.emit === false) {
      if (compilers.length !== 0) {
        assertSingleCompilerHost(compilers);
        return appendBuildOutput(
          checked,
          buildWithNativeCompilerPlugins(options, execution, compilers),
        );
      }
      if (checked.stdout !== "" || checked.stderr !== "") {
        return checked;
      }
      return runTsgo(execution, ["--noEmit"], options);
    }

    let result: ITtscBuildResult;
    if (compilers.length !== 0) {
      assertSingleCompilerHost(compilers);
      result = appendBuildOutput(
        checked,
        buildWithNativeCompilerPlugins(options, execution, compilers),
      );
    } else {
      if (
        checked.stdout === "" &&
        checked.stderr === "" &&
        options.skipDiagnosticsCheck !== true
      ) {
        const tsgoChecked = runTsgo(execution, ["--noEmit"], options);
        if (tsgoChecked.status !== 0) {
          return tsgoChecked;
        }
      }
      const args = createTsgoBuildArgs(execution, options, {
        listEmittedFiles:
          outputs.length !== 0 || options.forceListEmittedFiles === true,
      });
      const emitted = runTsgoBuild(execution, options, args);
      result = appendBuildOutput(checked, emitted);
    }

    if (result.status !== 0 || outputs.length === 0) {
      return result;
    }
    return appendBuildOutput(
      result,
      applyOutputPlugins(options, execution, result.emittedFiles ?? [], outputs),
    );
  }

  if (options.emit !== false && options.skipDiagnosticsCheck !== true) {
    const checked = runTsgo(execution, ["--noEmit"], options);
    if (checked.status !== 0) {
      return checked;
    }
  }

  const args = createTsgoBuildArgs(execution, options, {
    listEmittedFiles:
      options.emit !== false && options.forceListEmittedFiles === true,
  });
  return runTsgoBuild(execution, options, args);
}

function buildWithNativeCompilerPlugins(
  options: ITtscBuildOptions,
  execution: ITtscExecutionContext,
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscBuildResult {
  return runNativePluginCommand(
    plugins[0]!,
    createNativeBuildArgs(execution, options, plugins),
    options,
    execution,
    "ttsc.build",
  );
}

/**
 * Run `ttsc check` (build without emit) — CI gate / pre-commit hook use.
 * Resolves with an exit-code record; does not throw.
 */
export function check(options: ITtscCheckOptions = {}): ITtscBuildResult {
  return build({ ...options, emit: false });
}

function runTsgo(
  execution: ITtscExecutionContext,
  extraArgs: readonly string[],
  options: ITtscBuildOptions,
): ITtscBuildResult {
  const res = spawnBinary(
    execution.tsgo.binary,
    ["-p", execution.tsconfig, ...extraArgs],
    {
      cwd: execution.projectRoot,
      env: mergeEnv(options.env),
      encoding: "utf8",
    },
  );
  if (res.error) {
    throw new Error(
      "ttsc: failed to spawn " + execution.tsgo.binary + ": " + res.error.message,
    );
  }
  return normalizeFailedDiagnostics({
    status: res.status ?? 1,
    stdout: outputText(res.stdout),
    stderr: outputText(res.stderr),
  });
}

function runTsgoBuild(
  execution: ITtscExecutionContext,
  options: ITtscBuildOptions,
  args: readonly string[],
): ITtscBuildResult {
  const res = spawnBinary(execution.tsgo.binary, args, {
    cwd: execution.projectRoot,
    env: mergeEnv(options.env),
    encoding: "utf8",
  });
  if (res.error) {
    throw new Error(
      "ttsc.build: failed to spawn " +
        execution.tsgo.binary +
        ": " +
        res.error.message,
    );
  }
  const result = {
    status: res.status ?? 1,
    stdout: outputText(res.stdout),
    stderr: outputText(res.stderr),
  };
  const emittedFiles = parseEmittedFiles(result.stdout);
  if (emittedFiles.length !== 0) {
    result.stdout = stripEmittedFileLines(result.stdout);
  }
  return normalizeFailedDiagnostics({ ...result, emittedFiles });
}

function createTsgoBuildArgs(
  execution: ITtscExecutionContext,
  options: ITtscBuildOptions,
  flags: { listEmittedFiles: boolean },
): string[] {
  const args = ["-p", execution.tsconfig];
  if (options.emit === true) {
    args.push("--noEmit", "false", "--emitDeclarationOnly", "false");
  } else if (options.emit === false) {
    args.push("--noEmit");
  }
  if (options.outDir) {
    args.push("--outDir", path.resolve(execution.cwd, options.outDir));
  }
  if (flags.listEmittedFiles) {
    args.push("--listEmittedFiles");
  }
  return args;
}

function createNativeBuildArgs(
  execution: ITtscExecutionContext,
  options: ITtscBuildOptions,
  plugins: readonly ITtscLoadedNativePlugin[],
): string[] {
  const args = [
    options.emit === false ? "check" : "build",
    "--tsconfig=" + execution.tsconfig,
    "--rewrite-mode=" + (options.rewriteMode ?? plugins[0]?.backend.mode ?? "none"),
    "--plugins-json=" + serializeNativePlugins(plugins),
    "--cwd=" + execution.projectRoot,
  ];
  if (options.emit === true) {
    args.push("--emit");
  } else if (options.emit === false) {
    args.push("--noEmit");
  }
  if (options.outDir) {
    args.push("--outDir=" + path.resolve(execution.cwd, options.outDir));
  }
  if (options.quiet === false) {
    args.push("--verbose");
  } else if (options.quiet === true) {
    args.push("--quiet");
  }
  return args;
}

function createNativeCheckArgs(
  execution: ITtscExecutionContext,
  options: ITtscBuildOptions | ITtscTransformOptions,
  plugin: ITtscLoadedNativePlugin,
): string[] {
  const args = [
    "check",
    "--tsconfig=" + execution.tsconfig,
    "--rewrite-mode=" + (options.rewriteMode ?? plugin.backend.mode),
    "--plugins-json=" + serializeNativePlugins(execution.nativePlugins),
    "--cwd=" + execution.projectRoot,
  ];
  if ("outDir" in options && options.outDir) {
    args.push("--outDir=" + path.resolve(execution.cwd, options.outDir));
  }
  if ("quiet" in options && options.quiet === false) {
    args.push("--verbose");
  } else if ("quiet" in options && options.quiet === true) {
    args.push("--quiet");
  }
  return args;
}

function createNativeOutputArgs(
  execution: ITtscExecutionContext,
  options: ITtscBuildOptions | ITtscTransformOptions,
  plugin: ITtscLoadedNativePlugin,
  file: string,
): string[] {
  const args = [
    "output",
    "--file=" + file,
    "--tsconfig=" + execution.tsconfig,
    "--rewrite-mode=" + (options.rewriteMode ?? plugin.backend.mode),
    "--plugins-json=" + serializeNativePlugins(execution.nativePlugins),
    "--cwd=" + execution.projectRoot,
  ];
  if ("outDir" in options && options.outDir) {
    args.push("--outDir=" + path.resolve(execution.cwd, options.outDir));
  }
  return args;
}

function createNativeTransformArgs(
  execution: ITtscExecutionContext,
  options: ITtscTransformOptions,
  sourceFile: string,
  out: string,
  plugins: readonly ITtscLoadedNativePlugin[],
): string[] {
  return [
    "transform",
    "--file=" + sourceFile,
    "--out=" + out,
    "--tsconfig=" + execution.tsconfig,
    "--rewrite-mode=" + (options.rewriteMode ?? plugins[0]?.backend.mode ?? "none"),
    "--plugins-json=" + serializeNativePlugins(plugins),
  ];
}

function serializeNativePlugins(plugins: readonly ITtscLoadedNativePlugin[]): string {
  return JSON.stringify(
    plugins.map((plugin) => ({
      config: plugin.config,
      contractVersion: plugin.backend.contractVersion,
      mode: plugin.backend.mode,
      name: plugin.name,
    })),
  );
}

function runNativeCheckPlugins(
  options: ITtscBuildOptions | ITtscTransformOptions,
  execution: ITtscExecutionContext,
): ITtscBuildResult {
  let out: ITtscBuildResult = { status: 0, stdout: "", stderr: "" };
  for (const plugin of checkOnlyPlugins(execution.nativePlugins)) {
    const result = runNativePluginCommand(
      plugin,
      createNativeCheckArgs(execution, options, plugin),
      options,
      execution,
      "ttsc.check",
    );
    out = appendBuildOutput(out, result);
    if (result.status !== 0) {
      return out;
    }
  }
  return out;
}

function runNativeCompilerTransform(
  options: ITtscTransformOptions,
  execution: ITtscExecutionContext,
  sourceFile: string,
  out: string,
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscBuildResult {
  return runNativePluginCommand(
    plugins[0]!,
    createNativeTransformArgs(execution, options, sourceFile, out, plugins),
    options,
    execution,
    "ttsc.transform",
  );
}

function applyOutputPlugins(
  options: ITtscBuildOptions,
  execution: ITtscExecutionContext,
  emittedFiles: readonly string[],
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscBuildResult {
  let out: ITtscBuildResult = { status: 0, stdout: "", stderr: "" };
  for (const plugin of plugins) {
    for (const file of emittedFiles) {
      if (!fs.existsSync(file)) {
        continue;
      }
      const result = runNativeOutputPlugin(options, execution, plugin, file);
      out = appendBuildOutput(out, result);
      if (result.status !== 0) {
        return out;
      }
    }
  }
  return out;
}

function runNativeOutputPlugin(
  options: ITtscBuildOptions | ITtscTransformOptions,
  execution: ITtscExecutionContext,
  plugin: ITtscLoadedNativePlugin,
  file: string,
): ITtscBuildResult {
  return runNativePluginCommand(
    plugin,
    createNativeOutputArgs(execution, options, plugin, file),
    options,
    execution,
    "ttsc.output",
  );
}

function runNativePluginCommand(
  plugin: ITtscLoadedNativePlugin,
  args: readonly string[],
  options: ITtscBuildOptions | ITtscTransformOptions,
  execution: ITtscExecutionContext,
  label: string,
): ITtscBuildResult {
  const binary = plugin.backend.binary;
  if (!binary) {
    return {
      status: 2,
      stdout: "",
      stderr: `${label}: plugin "${plugin.name}" requires a version-matched binary\n`,
    };
  }
  const res = spawnBinary(binary, args, {
    cwd: execution.projectRoot,
    env: nativePluginEnv(options.env, execution),
    encoding: "utf8",
  });
  if (res.error) {
    throw new Error(
      `${label}: failed to spawn ${binary}: ${res.error.message}`,
    );
  }
  return normalizeFailedDiagnostics({
    status: res.status ?? 1,
    stdout: outputText(res.stdout),
    stderr: outputText(res.stderr),
  });
}

function appendBuildOutput(left: ITtscBuildResult, right: ITtscBuildResult): ITtscBuildResult {
  return normalizeFailedDiagnostics({
    emittedFiles:
      right.emittedFiles !== undefined ? right.emittedFiles : left.emittedFiles,
    status: right.status !== 0 ? right.status : left.status,
    stdout: left.stdout + right.stdout,
    stderr: left.stderr + right.stderr,
  });
}

function assertSingleCompilerHost(plugins: readonly ITtscLoadedNativePlugin[]): void {
  const binaries = [
    ...new Set(
      plugins
        .map((plugin) => plugin.backend.binary)
        .filter((binary): binary is string => typeof binary === "string"),
    ),
  ];
  if (binaries.length > 1) {
    throw new Error(
      "ttsc: multiple compiler native backends cannot share one emit pass; " +
        "use output-capability plugins for post-emit transforms",
    );
  }
}

/** Ask the binary for its version banner. Handy for user-agent strings. */
export function version(options: ITtscCommonOptions = {}): string {
  const tsgo = resolveTsgo(options);
  const res = spawnBinary(tsgo.binary, ["--version"], {
    encoding: "utf8",
  });
  if (res.error || res.status !== 0) {
    throw new Error(
      "ttsc.version: failed: " + (outputText(res.stderr) || res.error?.message),
    );
  }
  return `ttsc ${readOwnPackageVersion()} (${outputText(res.stdout).trim()})`;
}

/**
 * Promise-facing variant of `transform()`. The host path stays synchronous so
 * plugin descriptors can stay dependency-free, but many adapter surfaces still
 * prefer a Promise-returning function.
 */
export function transformAsync(options: ITtscTransformOptions): Promise<string> {
  return Promise.resolve().then(() => transform(options));
}

interface ITtscExecutionContext {
  compilerOptions: Record<string, unknown>;
  cwd: string;
  nativePlugins: readonly ITtscLoadedNativePlugin[];
  projectRoot: string;
  tsgo: ITtscResolvedTsgo;
  tsconfig: string;
}

function resolveExecutionContext(
  options: ITtscCommonOptions & { tsconfig?: string },
): ITtscExecutionContext {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const tsconfig = resolveProjectConfig({
    cwd,
    tsconfig: options.tsconfig,
  });
  const projectRoot = resolveProjectRoot({ cwd, tsconfig });
  const tsgo = resolveTsgo({ ...options, cwd: projectRoot });
  const fallbackBinary = resolveBinary(options);
  const loaded = loadProjectPlugins({
    binary: fallbackBinary ?? "",
    cwd,
    entries: options.plugins,
    tsconfig,
  });
  return {
    compilerOptions: loaded.project.compilerOptions,
    cwd,
    nativePlugins: loaded.nativePlugins,
    projectRoot,
    tsgo,
    tsconfig,
  };
}

function isJavaScriptOutput(file: string): boolean {
  return /\.(?:[cm]?js)$/i.test(file);
}

function parseEmittedFiles(stdout: string): string[] {
  const out: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^TSFILE:\s*(.+)$/);
    if (match?.[1]) {
      out.push(path.resolve(match[1].trim()));
    }
  }
  return out;
}

function stripEmittedFileLines(stdout: string): string {
  return stdout
    .split(/\r?\n/)
    .filter((line) => !/^TSFILE:\s*/.test(line))
    .join("\n")
    .replace(/\n+$/, "");
}

function normalizeFailedDiagnostics(result: ITtscBuildResult): ITtscBuildResult {
  if (result.status === 0 || result.stderr.trim().length !== 0) {
    return result;
  }
  if (result.stdout.trim().length === 0) {
    return result;
  }
  return {
    emittedFiles: result.emittedFiles,
    status: result.status,
    stdout: "",
    stderr: result.stdout,
  };
}

function findEmittedFile(
  outDir: string,
  projectRoot: string,
  sourceFile: string,
): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const file of listJavaScriptFiles(outDir)) {
    const score = sharedSourceStemSegments(file, sourceFile);
    if (score > bestScore) {
      best = file;
      bestScore = score;
    }
  }
  if (best) {
    return best;
  }
  const relative = path.relative(projectRoot, sourceFile);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    const exact = path.resolve(outDir, relative).replace(/\.[cm]?tsx?$/i, ".js");
    if (fs.existsSync(exact)) {
      return exact;
    }
  }
  return null;
}

function listJavaScriptFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    if (!fs.existsSync(current)) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile() && isJavaScriptOutput(next)) {
        out.push(next);
      }
    }
  }
  return out;
}

function sharedSourceStemSegments(outPath: string, srcPath: string): number {
  const trim = (value: string): string[] => {
    const normalized = value.replace(/\\/g, "/");
    return normalized.replace(/\.[^.]+$/, "").split("/");
  };
  const a = trim(outPath);
  const b = trim(srcPath);
  const n = Math.min(a.length, b.length);
  let shared = 0;
  for (let i = 1; i <= n; i += 1) {
    if (a[a.length - i] !== b[b.length - i]) break;
    shared += 1;
  }
  return shared;
}

function readOwnPackageVersion(): string {
  try {
    const file = path.resolve(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
