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

import { type ResolveOptions, resolveBinary } from "./platform";
import {
  type TtscPlugin,
  applyPluginTransforms,
  loadProjectPlugins,
} from "./plugin";
import {
  type ProjectPluginConfig,
  resolveProjectConfig,
  resolveProjectRoot,
} from "./project";
import { type ResolvedTsgo, resolveTsgo } from "./tsgo";

/**
 * Options shared by every API call. `binary` takes precedence over platform
 * resolution; `cwd` defaults to `process.cwd()`; `env` layers on top of the
 * current process env.
 */
export interface CommonOptions extends ResolveOptions {
  /** Absolute path to an already-resolved tsgo binary. Skips package resolution. */
  binary?: string;
  /** Working directory passed to the child process. */
  cwd?: string;
  /** Extra environment variables; merged onto `process.env`. */
  env?: NodeJS.ProcessEnv;
  /**
   * Override project plugin loading. `false` disables tsconfig plugins; an
   * array replaces the tsconfig `compilerOptions.plugins` list.
   */
  plugins?: readonly ProjectPluginConfig[] | false;
  /**
   * Override the native rewrite backend. Defaults to the loaded plugin mode.
   *
   * @deprecated Prefer plugin-declared `native.mode`; this override is for
   *   low-level tests and migration probes.
   */
  rewriteMode?: string;
}

/** Options for `transform()`. */
export interface TransformOptions extends CommonOptions {
  /** Path to the .ts file to transform. Absolute or `cwd`-relative. */
  file: string;
  /** Path to the tsconfig owning `file`. Default: `tsconfig.json`. */
  tsconfig?: string;
  /**
   * When provided, the binary writes JS directly to this path instead of piping
   * stdout. Useful when the emitted text is large.
   */
  out?: string;
}

/** Options for `build()`. */
export interface BuildOptions extends CommonOptions {
  /** Path to tsconfig.json. Default: `tsconfig.json`. */
  tsconfig?: string;
  /**
   * Emit override. `true` forces emit, `false` forces noEmit, `undefined`
   * follows tsconfig.
   */
  emit?: boolean;
  /** Override compilerOptions.outDir for this invocation. */
  outDir?: string;
  /** Suppress the per-call summary banner. Default: `true`. */
  quiet?: boolean;
  /** @internal Caller already ran diagnostics and accepts responsibility. */
  skipDiagnosticsCheck?: boolean;
}

/** Options for `check()`. */
export type CheckOptions = Omit<BuildOptions, "emit">;

/** Merge spawn env without clobbering unrelated vars. */
function mergeEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (!extra) return process.env;
  return { ...process.env, ...extra };
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
export function transform(options: TransformOptions): string {
  const execution = resolveExecutionContext(options);
  const sourceFile = realpathIfExists(
    path.isAbsolute(options.file)
      ? options.file
      : path.resolve(options.cwd ?? process.cwd(), options.file),
  );
  if (execution.nativeBinary) {
    return transformWithNativeBinary(options, execution, sourceFile);
  }
  if (execution.nativeMode !== "none") {
    throw new Error(
      `ttsc.transform: native rewrite mode "${execution.nativeMode}" requires a plugin-provided version-matched binary`,
    );
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
    const transformed = finalizeTransformText(
      execution.plugins,
      {
        command: "transform",
        cwd: execution.cwd,
        projectRoot: execution.projectRoot,
        sourceFile,
        tsconfig: execution.tsconfig,
      },
      fs.readFileSync(emitted, "utf8"),
    );
    if (options.out) {
      fs.mkdirSync(path.dirname(options.out), { recursive: true });
      fs.writeFileSync(options.out, transformed, "utf8");
    }
    return transformed;
  } finally {
    fs.rmSync(tempOutDir, { recursive: true, force: true });
  }
}

function transformWithNativeBinary(
  options: TransformOptions,
  execution: ExecutionContext,
  sourceFile: string,
): string {
  const args = [
    "transform",
    "--file=" + sourceFile,
    "--tsconfig=" + execution.tsconfig,
    "--rewrite-mode=" + execution.nativeMode,
  ];

  const res = spawnBinary(execution.nativeBinary!, args, {
    cwd: options.cwd,
    env: mergeEnv(options.env),
    encoding: "utf8",
  });
  if (res.error) {
    throw new Error(
      "ttsc.transform: failed to spawn " +
        execution.nativeBinary +
        ": " +
        res.error.message,
    );
  }
  if (res.status !== 0) {
    throw new Error(
      "ttsc.transform exited " + res.status + "\n" + (res.stderr || ""),
    );
  }
  const transformed = finalizeTransformText(
    execution.plugins,
    {
      command: "transform",
      cwd: execution.cwd,
      projectRoot: execution.projectRoot,
      sourceFile,
      tsconfig: execution.tsconfig,
    },
    outputText(res.stdout),
  );
  if (options.out) {
    fs.mkdirSync(path.dirname(options.out), { recursive: true });
    fs.writeFileSync(options.out, transformed, "utf8");
  }
  return transformed;
}

function realpathIfExists(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    return file;
  }
}

/** Result of `build()`. Non-zero `status` means the build failed. */
export interface BuildResult {
  status: number;
  stdout: string;
  stderr: string;
}

/**
 * Run `ttsc` against a tsconfig. Returns once the binary exits so the caller
 * can decide how to surface diagnostics. Does not throw on non-zero exit —
 * bundler pipelines often want to continue and collect errors.
 */
export function build(options: BuildOptions = {}): BuildResult {
  const execution = resolveExecutionContext(options);
  if (execution.nativeBinary) {
    return buildWithNativeBinary(options, execution);
  }
  if (execution.nativeMode !== "none") {
    return {
      status: 2,
      stdout: "",
      stderr:
        `ttsc.build: native rewrite mode "${execution.nativeMode}" requires ` +
        "a version-matched sidecar build; project builds use the consuming project's @typescript/native-preview by default\n",
    };
  }

  if (options.emit !== false && options.skipDiagnosticsCheck !== true) {
    const checked = runTsgo(execution, ["--noEmit"], options);
    if (checked.status !== 0) {
      return checked;
    }
  }

  const args = createTsgoBuildArgs(execution, options, {
    listEmittedFiles: options.emit !== false && execution.plugins.length > 0,
  });
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
  if (result.status === 0 && options.emit !== false && execution.plugins.length > 0) {
    applyBuildPlugins(execution.plugins, execution, emittedFiles);
  }
  return normalizeFailedDiagnostics(result);
}

function buildWithNativeBinary(
  options: BuildOptions,
  execution: ExecutionContext,
): BuildResult {
  const args = createNativeBuildArgs(execution, options);
  const res = spawnBinary(execution.nativeBinary!, args, {
    cwd: execution.projectRoot,
    env: mergeEnv(options.env),
    encoding: "utf8",
  });
  if (res.error) {
    throw new Error(
      "ttsc.build: failed to spawn " +
        execution.nativeBinary +
        ": " +
        res.error.message,
    );
  }
  return normalizeFailedDiagnostics({
    status: res.status ?? 1,
    stdout: outputText(res.stdout),
    stderr: outputText(res.stderr),
  });
}

/**
 * Run `ttsc check` (build without emit) — CI gate / pre-commit hook use.
 * Resolves with an exit-code record; does not throw.
 */
export function check(options: CheckOptions = {}): BuildResult {
  return build({ ...options, emit: false });
}

function runTsgo(
  execution: ExecutionContext,
  extraArgs: readonly string[],
  options: BuildOptions,
): BuildResult {
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

function createTsgoBuildArgs(
  execution: ExecutionContext,
  options: BuildOptions,
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
  execution: ExecutionContext,
  options: BuildOptions,
): string[] {
  const args = [
    options.emit === false ? "check" : "build",
    "--tsconfig=" + execution.tsconfig,
    "--rewrite-mode=" + execution.nativeMode,
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

/** Ask the binary for its version banner. Handy for user-agent strings. */
export function version(options: CommonOptions = {}): string {
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
 * Promise-facing variant of `transform()`. The plugin host keeps the transform
 * pipeline synchronous so plugin modules can stay dependency-free, but many
 * adapter surfaces still prefer a Promise-returning function.
 */
export function transformAsync(options: TransformOptions): Promise<string> {
  return Promise.resolve().then(() => transform(options));
}

interface ExecutionContext {
  cwd: string;
  nativeBinary: string | null;
  nativeMode: string;
  plugins: readonly TtscPlugin[];
  projectRoot: string;
  tsgo: ResolvedTsgo;
  tsconfig: string;
}

function resolveExecutionContext(
  options: CommonOptions & { tsconfig?: string },
): ExecutionContext {
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
    cwd,
    nativeBinary: loaded.nativeBinary ?? null,
    nativeMode: options.rewriteMode ?? loaded.nativeMode,
    plugins: loaded.plugins.filter((plugin) => plugin.transformOutput),
    projectRoot,
    tsgo,
    tsconfig,
  };
}

function finalizeTransformText(
  plugins: readonly TtscPlugin[],
  context: Omit<Parameters<typeof applyPluginTransforms>[1], "code">,
  text: string,
): string {
  if (plugins.length === 0) {
    return text;
  }
  return applyPluginTransforms(plugins, {
    ...context,
    code: text,
  });
}

function applyBuildPlugins(
  plugins: readonly TtscPlugin[],
  execution: ExecutionContext,
  emittedFiles: readonly string[],
): void {
  if (plugins.length === 0) {
    return;
  }
  for (const file of emittedFiles) {
    if (!isJavaScriptOutput(file) || !fs.existsSync(file)) {
      continue;
    }
    const current = fs.readFileSync(file, "utf8");
    const next = applyPluginTransforms(plugins, {
      code: current,
      command: "build",
      cwd: execution.cwd,
      outputFile: file,
      projectRoot: execution.projectRoot,
      tsconfig: execution.tsconfig,
    });
    if (next !== current) {
      fs.writeFileSync(file, next, "utf8");
    }
  }
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

function normalizeFailedDiagnostics(result: BuildResult): BuildResult {
  if (result.status === 0 || result.stderr.trim().length !== 0) {
    return result;
  }
  if (result.stdout.trim().length === 0) {
    return result;
  }
  return {
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
