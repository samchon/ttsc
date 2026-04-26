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
  type TtscSourceTransformStage,
  type TtscPlugin,
  applyPluginSourceTransformsWithMap,
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
  /** @internal Force `tsgo --listEmittedFiles` even when no output plugin runs. */
  forceListEmittedFiles?: boolean;
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
  if (execution.sourcePlugins.length > 0) {
    return transformWithSourceTransforms(options, execution, sourceFile);
  }
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
      execution.outputPlugins,
      {
        command: "transform",
        compilerOptions: execution.compilerOptions,
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
    execution.outputPlugins,
    {
      command: "transform",
      compilerOptions: execution.compilerOptions,
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

function transformWithSourceTransforms(
  options: TransformOptions,
  execution: ExecutionContext,
  sourceFile: string,
): string {
  if (execution.nativeBinary || execution.nativeMode !== "none") {
    throw new Error(
      "ttsc.transform: transformSource cannot be combined with native rewrite mode yet",
    );
  }
  const materialized = materializeSourceTransformedProject(
    execution,
    "transform",
    sourceFile,
  );
  const tempOutDir = path.join(materialized.root, ".ttsc-transform-out");
  try {
    const tempSourceFile = toMaterializedPath(sourceFile, materialized);
    const result = build({
      ...options,
      cwd: materialized.root,
      emit: true,
      forceListEmittedFiles: true,
      outDir: tempOutDir,
      plugins: false,
      tsconfig: materialized.tsconfig,
    });
    if (result.status !== 0) {
      throw new Error(
        "ttsc.transform exited " +
          result.status +
          "\n" +
          (result.stderr || result.stdout),
      );
    }
    const emitted = findEmittedFile(tempOutDir, materialized.root, tempSourceFile);
    if (!emitted) {
      throw new Error(`ttsc.transform: no output produced for ${sourceFile}`);
    }
    let transformed = finalizeTransformText(
      execution.outputPlugins,
      {
        command: "transform",
        compilerOptions: execution.compilerOptions,
        cwd: execution.cwd,
        projectRoot: execution.projectRoot,
        sourceFile,
        tsconfig: execution.tsconfig,
      },
      fs.readFileSync(emitted, "utf8"),
    );
    if (options.out) {
      const mapFile = `${emitted}.map`;
      if (fs.existsSync(mapFile)) {
        const outMap = `${options.out}.map`;
        fs.mkdirSync(path.dirname(outMap), { recursive: true });
        fs.writeFileSync(
          outMap,
          patchSourceMapText(
            fs.readFileSync(mapFile, "utf8"),
            materialized,
            outMap,
            mapFile,
          ),
          "utf8",
        );
        transformed = rewriteSourceMapReference(transformed, path.basename(outMap));
      }
      fs.mkdirSync(path.dirname(options.out), { recursive: true });
      fs.writeFileSync(options.out, transformed, "utf8");
    }
    return transformed;
  } finally {
    fs.rmSync(materialized.root, { recursive: true, force: true });
  }
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
  emittedFiles?: string[];
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
  if (execution.sourcePlugins.length > 0) {
    return buildWithSourceTransforms(options, execution);
  }
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
    listEmittedFiles:
      options.emit !== false &&
      (execution.outputPlugins.length > 0 || options.forceListEmittedFiles === true),
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
  if (result.status === 0 && options.emit !== false && execution.outputPlugins.length > 0) {
    applyBuildPlugins(execution.outputPlugins, execution, emittedFiles);
  }
  return normalizeFailedDiagnostics({ ...result, emittedFiles });
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

function buildWithSourceTransforms(
  options: BuildOptions,
  execution: ExecutionContext,
): BuildResult {
  if (execution.nativeBinary || execution.nativeMode !== "none") {
    return {
      status: 2,
      stdout: "",
      stderr:
        "ttsc.build: transformSource cannot be combined with native rewrite mode yet\n",
    };
  }
  const materialized = materializeSourceTransformedProject(execution, "build");
  try {
    const outDir = mapOutDirToMaterializedProject(options.outDir, execution, materialized);
    const result = build({
      ...options,
      cwd: materialized.root,
      forceListEmittedFiles: true,
      outDir,
      plugins: false,
      tsconfig: materialized.tsconfig,
    });
    if (result.status === 0 && options.emit !== false) {
      const copied = copyMaterializedEmittedFiles(materialized, result.emittedFiles ?? []);
      result.emittedFiles = copied;
      if (execution.outputPlugins.length > 0) {
        applyBuildPlugins(execution.outputPlugins, execution, copied);
      }
    }
    return result;
  } finally {
    fs.rmSync(materialized.root, { recursive: true, force: true });
  }
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
  compilerOptions: Record<string, unknown>;
  cwd: string;
  nativeBinary: string | null;
  nativeMode: string;
  outputPlugins: readonly TtscPlugin[];
  projectRoot: string;
  sourcePlugins: readonly TtscPlugin[];
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
    compilerOptions: loaded.project.compilerOptions,
    cwd,
    nativeBinary: loaded.nativeBinary ?? null,
    nativeMode: options.rewriteMode ?? loaded.nativeMode,
    outputPlugins: loaded.plugins.filter((plugin) => plugin.transformOutput),
    projectRoot,
    sourcePlugins: loaded.plugins.filter((plugin) => plugin.transformSource),
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
      compilerOptions: execution.compilerOptions,
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

interface MaterializedProject {
  mappers: Map<string, SourcePositionMapper>;
  originalRoot: string;
  root: string;
  tsconfig: string;
}

interface SourcePositionMapper {
  finalCode: string;
  originalCode: string;
  stages: readonly TtscSourceTransformStage[];
}

function materializeSourceTransformedProject(
  execution: ExecutionContext,
  command: "build" | "transform",
  onlySourceFile?: string,
): MaterializedProject {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-"));
  const materialized: MaterializedProject = {
    mappers: new Map(),
    originalRoot: execution.projectRoot,
    root,
    tsconfig: path.join(root, path.relative(execution.projectRoot, execution.tsconfig)),
  };
  copyProjectForSourceTransforms(execution.projectRoot, root, execution.compilerOptions);
  const files = onlySourceFile
    ? [toMaterializedPath(onlySourceFile, materialized)]
    : listSourceTransformFiles(root);
  for (const tempFile of files) {
    if (!fs.existsSync(tempFile) || !fs.statSync(tempFile).isFile()) {
      continue;
    }
    const originalFile = fromMaterializedPath(tempFile, materialized);
    const current = fs.readFileSync(tempFile, "utf8");
    const transformed = applyPluginSourceTransformsWithMap(execution.sourcePlugins, {
      code: current,
      command,
      compilerOptions: execution.compilerOptions,
      cwd: execution.cwd,
      projectRoot: execution.projectRoot,
      sourceFile: originalFile,
      tsconfig: execution.tsconfig,
    });
    const next = transformed.code;
    if (next !== current) {
      fs.writeFileSync(tempFile, next, "utf8");
    }
    if (transformed.stages.length > 0) {
      materialized.mappers.set(filepathKey(tempFile), {
        finalCode: next,
        originalCode: current,
        stages: transformed.stages,
      });
    }
  }
  return materialized;
}

function copyProjectForSourceTransforms(
  source: string,
  target: string,
  compilerOptions: Record<string, unknown>,
): void {
  const excluded = new Set([".git", "node_modules"]);
  const outDir = typeof compilerOptions.outDir === "string" ? compilerOptions.outDir : "";
  const resolvedOutDir = outDir ? path.resolve(outDir) : "";
  copyDirectoryFiltered(source, target, (entry) => {
    if (excluded.has(path.basename(entry))) {
      return false;
    }
    if (resolvedOutDir && isPathInside(entry, resolvedOutDir)) {
      return false;
    }
    return true;
  });
  const nodeModules = path.join(source, "node_modules");
  if (fs.existsSync(nodeModules)) {
    const targetNodeModules = path.join(target, "node_modules");
    try {
      fs.symlinkSync(nodeModules, targetNodeModules, "junction");
    } catch {
      copyDirectoryFiltered(nodeModules, targetNodeModules, () => true);
    }
  }
}

function copyDirectoryFiltered(
  source: string,
  target: string,
  shouldCopy: (entry: string) => boolean,
): void {
  if (!shouldCopy(source)) {
    return;
  }
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) {
    const link = fs.readlinkSync(source);
    fs.symlinkSync(link, target);
    return;
  }
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyDirectoryFiltered(path.join(source, entry), path.join(target, entry), shouldCopy);
    }
    return;
  }
  if (stat.isFile()) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

function listSourceTransformFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile() && isTransformableSource(next)) {
        out.push(next);
      }
    }
  }
  return out;
}

function isTransformableSource(file: string): boolean {
  return /\.(?:[cm]?tsx?)$/i.test(file) && !/\.d\.[cm]?ts$/i.test(file);
}

function mapOutDirToMaterializedProject(
  outDir: string | undefined,
  execution: ExecutionContext,
  materialized: MaterializedProject,
): string | undefined {
  if (!outDir) {
    return undefined;
  }
  const resolved = path.resolve(execution.cwd, outDir);
  if (isPathInside(resolved, execution.projectRoot)) {
    return toMaterializedPath(resolved, materialized);
  }
  return path.join(materialized.root, ".ttsc-out");
}

function copyMaterializedEmittedFiles(
  materialized: MaterializedProject,
  emittedFiles: readonly string[],
): string[] {
  const copied: string[] = [];
  for (const emitted of emittedFiles) {
    if (!isPathInside(emitted, materialized.root)) {
      continue;
    }
    const target = fromMaterializedPath(emitted, materialized);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (/\.map$/i.test(emitted)) {
      fs.writeFileSync(
        target,
        patchSourceMapText(fs.readFileSync(emitted, "utf8"), materialized, target),
        "utf8",
      );
    } else {
      fs.copyFileSync(emitted, target);
    }
    copied.push(target);
  }
  return copied;
}

function toMaterializedPath(file: string, materialized: MaterializedProject): string {
  const relative = path.relative(materialized.originalRoot, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return file;
  }
  return path.join(materialized.root, relative);
}

function fromMaterializedPath(file: string, materialized: MaterializedProject): string {
  const relative = path.relative(materialized.root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return file;
  }
  return path.join(materialized.originalRoot, relative);
}

function isPathInside(file: string, parent: string): boolean {
  const relative = path.relative(parent, file);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function filepathKey(file: string): string {
  return path.resolve(file).replace(/\\/g, "/");
}

function patchSourceMapText(
  text: string,
  materialized: MaterializedProject,
  outputFile: string,
  tempOutputFile = toMaterializedPath(outputFile, materialized),
): string {
  let map: {
    sourceRoot?: string;
    sources?: string[];
    sourcesContent?: string[];
    [key: string]: unknown;
  };
  try {
    map = JSON.parse(text);
  } catch {
    return text;
  }
  if (!Array.isArray(map.sources)) {
    return text;
  }
  const tempMapDir = path.dirname(tempOutputFile);
  const originalMapDir = path.dirname(outputFile);
  const nextSources: string[] = [];
  const nextSourcesContent = Array.isArray(map.sourcesContent)
    ? [...map.sourcesContent]
    : undefined;
  const sourceMappings = new Map<number, SourcePositionMapper>();
  map.sources.forEach((source, index) => {
    const tempSource = path.isAbsolute(source)
      ? source
      : path.resolve(tempMapDir, source);
    if (isPathInside(tempSource, materialized.root)) {
      const originalSource = fromMaterializedPath(tempSource, materialized);
      const mapper = materialized.mappers.get(filepathKey(tempSource));
      if (mapper) {
        sourceMappings.set(index, mapper);
      }
      nextSources.push(relativeSourceMapPath(originalMapDir, originalSource));
      if (nextSourcesContent) {
        try {
          nextSourcesContent[index] = fs.readFileSync(originalSource, "utf8");
        } catch {
          /* keep emitted sourcesContent */
        }
      }
    } else {
      nextSources.push(source);
    }
  });
  if (sourceMappings.size > 0 && typeof map.mappings === "string") {
    map.mappings = remapSourceMapMappings(map.mappings, sourceMappings);
  }
  map.sources = nextSources;
  if (nextSourcesContent) {
    map.sourcesContent = nextSourcesContent;
  }
  delete map.sourceRoot;
  return JSON.stringify(map);
}

function relativeSourceMapPath(fromDir: string, file: string): string {
  const relative = path.relative(fromDir, file).replace(/\\/g, "/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function rewriteSourceMapReference(code: string, mapFileName: string): string {
  const reference = `//# sourceMappingURL=${mapFileName}`;
  if (/\/\/# sourceMappingURL=.*(?:\r?\n)?$/m.test(code)) {
    return code.replace(/\/\/# sourceMappingURL=.*(?:\r?\n)?$/m, `${reference}\n`);
  }
  return code.endsWith("\n") ? `${code}${reference}\n` : `${code}\n${reference}\n`;
}

function remapSourceMapMappings(
  mappings: string,
  sourceMappings: Map<number, SourcePositionMapper>,
): string {
  const decoded = decodeMappings(mappings);
  for (const line of decoded) {
    for (const segment of line) {
      if (segment.length < 4) {
        continue;
      }
      const mapper = sourceMappings.get(segment[1]!);
      if (!mapper) {
        continue;
      }
      const mapped = mapTransformedPositionToOriginal(mapper, {
        column: segment[3]!,
        line: segment[2]!,
      });
      segment[2] = mapped.line;
      segment[3] = mapped.column;
    }
  }
  return encodeMappings(decoded);
}

function mapTransformedPositionToOriginal(
  mapper: SourcePositionMapper,
  position: { line: number; column: number },
): { line: number; column: number } {
  let offset = lineColumnToOffset(mapper.finalCode, position.line, position.column);
  for (let index = mapper.stages.length - 1; index >= 0; index -= 1) {
    offset = mapOffsetToPreviousStage(offset, mapper.stages[index]!);
  }
  return offsetToLineColumn(mapper.originalCode, offset);
}

function mapOffsetToPreviousStage(
  offset: number,
  stage: TtscSourceTransformStage,
): number {
  let delta = 0;
  for (const edit of stage.edits) {
    if (offset < edit.newStart) {
      return clampOffset(offset - delta, stage.before.length);
    }
    if (offset < edit.newEnd) {
      return edit.start;
    }
    delta += edit.code.length - (edit.end - edit.start);
  }
  return clampOffset(offset - delta, stage.before.length);
}

function lineColumnToOffset(source: string, line: number, column: number): number {
  const starts = lineStarts(source);
  const start = starts[Math.min(Math.max(line, 0), starts.length - 1)] ?? 0;
  return clampOffset(start + Math.max(column, 0), source.length);
}

function offsetToLineColumn(
  source: string,
  offset: number,
): { line: number; column: number } {
  const starts = lineStarts(source);
  const clamped = clampOffset(offset, source.length);
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const start = starts[mid]!;
    const next = starts[mid + 1] ?? Number.POSITIVE_INFINITY;
    if (clamped < start) {
      high = mid - 1;
    } else if (clamped >= next) {
      low = mid + 1;
    } else {
      return { column: clamped - start, line: mid };
    }
  }
  const last = starts.length - 1;
  return { column: clamped - (starts[last] ?? 0), line: last };
}

function lineStarts(source: string): number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    const ch = source.charCodeAt(index);
    if (ch === 13 /* \r */) {
      if (source.charCodeAt(index + 1) === 10 /* \n */) {
        index += 1;
      }
      starts.push(index + 1);
    } else if (ch === 10 /* \n */) {
      starts.push(index + 1);
    }
  }
  return starts;
}

function clampOffset(offset: number, length: number): number {
  return Math.min(Math.max(offset, 0), length);
}

type SourceMapSegment = number[];
type DecodedMappings = SourceMapSegment[][];

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_VALUES = new Map(
  [...BASE64_CHARS].map((char, index) => [char, index] as const),
);

function decodeMappings(mappings: string): DecodedMappings {
  const lines: DecodedMappings = [];
  let line: SourceMapSegment[] = [];
  let segment: SourceMapSegment = [];
  let index = 0;
  const state = [0, 0, 0, 0, 0];
  while (index < mappings.length) {
    const char = mappings[index]!;
    if (char === ";") {
      if (segment.length > 0) {
        line.push(segment);
        segment = [];
      }
      lines.push(line);
      line = [];
      state[0] = 0;
      index += 1;
      continue;
    }
    if (char === ",") {
      if (segment.length > 0) {
        line.push(segment);
        segment = [];
      }
      index += 1;
      continue;
    }
    const read = readVlq(mappings, index);
    index = read.next;
    const field = segment.length;
    state[field] = (state[field] ?? 0) + read.value;
    segment.push(state[field]!);
  }
  if (segment.length > 0) {
    line.push(segment);
  }
  lines.push(line);
  return lines;
}

function encodeMappings(lines: DecodedMappings): string {
  const state = [0, 0, 0, 0, 0];
  return lines
    .map((line) => {
      state[0] = 0;
      return line
        .map((segment) =>
          segment
            .map((value, index) => {
              const relative = value - (state[index] ?? 0);
              state[index] = value;
              return writeVlq(relative);
            })
            .join(""),
        )
        .join(",");
    })
    .join(";");
}

function readVlq(input: string, start: number): { next: number; value: number } {
  let index = start;
  let shift = 0;
  let value = 0;
  while (index < input.length) {
    const digit = BASE64_VALUES.get(input[index]!);
    if (digit === undefined) {
      throw new Error(`ttsc: invalid source map VLQ digit ${input[index]}`);
    }
    index += 1;
    const continuation = (digit & 32) !== 0;
    value += (digit & 31) << shift;
    shift += 5;
    if (!continuation) {
      const negative = (value & 1) === 1;
      const decoded = value >> 1;
      return { next: index, value: negative ? -decoded : decoded };
    }
  }
  throw new Error("ttsc: unterminated source map VLQ segment");
}

function writeVlq(value: number): string {
  let vlq = Math.abs(value) << 1;
  if (value < 0) {
    vlq |= 1;
  }
  let out = "";
  do {
    let digit = vlq & 31;
    vlq >>>= 5;
    if (vlq > 0) {
      digit |= 32;
    }
    out += BASE64_CHARS[digit]!;
  } while (vlq > 0);
  return out;
}
