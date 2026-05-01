import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { loadProjectPlugins } from "../../plugin/internal/loadProjectPlugins";
import type { ITtscCompilerDiagnostic } from "../../structures/ITtscCompilerDiagnostic";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { TtscBuildOptions } from "../../structures/internal/TtscBuildOptions";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";
import { resolveProjectConfig } from "./project/resolveProjectConfig";
import { resolveBinary } from "./resolveBinary";
import { resolveTsgo } from "./resolveTsgo";

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
  execution: ReturnType<typeof resolveExecutionContext>,
): NodeJS.ProcessEnv {
  return mergeEnv({
    TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? execution.tsgo.binary,
    TTSC_TTSX_BINARY:
      process.env.TTSC_TTSX_BINARY ??
      path.join(__dirname, "..", "..", "launcher", "ttsx.js"),
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
  const viaNode = /\.(?:[cm]?js|ts)$/i.test(binary);
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
 * Run `ttsc` against a tsconfig. Returns once the binary exits so the CLI can
 * decide how to surface diagnostics. Does not throw on non-zero exit.
 */
export function runBuild(
  options: TtscBuildOptions & {
    skipDiagnosticsCheck?: boolean;
    forceListEmittedFiles?: boolean;
  } = {},
): TtscBuildResult {
  const execution = resolveExecutionContext(options);
  if (execution.nativePlugins.length > 0) {
    const compilers = execution.nativePlugins.filter(
      (plugin) => plugin.stage === "transform",
    );
    const outputs = execution.nativePlugins.filter(
      (plugin) => plugin.stage === "output",
    );
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

    let result: TtscBuildResult;
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
      applyOutputPlugins(
        options,
        execution,
        result.emittedFiles ?? [],
        outputs,
      ),
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
  options: TtscBuildOptions,
  execution: ReturnType<typeof resolveExecutionContext>,
  plugins: readonly ITtscLoadedNativePlugin[],
): TtscBuildResult {
  return runNativePluginCommand(
    plugins[0]!,
    createNativeBuildArgs(execution, options, plugins),
    options,
    execution,
    "ttsc.build",
  );
}

function runTsgo(
  execution: ReturnType<typeof resolveExecutionContext>,
  extraArgs: readonly string[],
  options: NonNullable<Parameters<typeof runBuild>[0]>,
): TtscBuildResult {
  const res = spawnBinary(
    execution.tsgo.binary,
    [
      "-p",
      execution.tsconfig,
      ...extraArgs,
      ...createTsgoDiagnosticArgs(options),
    ],
    {
      cwd: execution.projectRoot,
      env: mergeEnv(options.env),
      encoding: "utf8",
    },
  );
  if (res.error) {
    throw new Error(
      "ttsc: failed to spawn " +
        execution.tsgo.binary +
        ": " +
        res.error.message,
    );
  }
  return normalizeFailedDiagnostics(
    {
      status: res.status ?? 1,
      stdout: outputText(res.stdout),
      stderr: outputText(res.stderr),
    },
    execution.projectRoot,
  );
}

function runTsgoBuild(
  execution: ReturnType<typeof resolveExecutionContext>,
  options: NonNullable<Parameters<typeof runBuild>[0]>,
  args: readonly string[],
): TtscBuildResult {
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
  return normalizeFailedDiagnostics(
    { ...result, emittedFiles },
    execution.projectRoot,
  );
}

function createTsgoBuildArgs(
  execution: ReturnType<typeof resolveExecutionContext>,
  options: NonNullable<Parameters<typeof runBuild>[0]>,
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
  args.push(...createTsgoDiagnosticArgs(options));
  return args;
}

function createTsgoDiagnosticArgs(options: TtscCommonOptions): string[] {
  return options.structuredDiagnostics === true ? ["--pretty", "false"] : [];
}

function createNativeBuildArgs(
  execution: ReturnType<typeof resolveExecutionContext>,
  options: TtscBuildOptions,
  plugins: readonly ITtscLoadedNativePlugin[],
): string[] {
  const args = [
    options.emit === false ? "check" : "build",
    "--tsconfig=" + execution.tsconfig,
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
  execution: ReturnType<typeof resolveExecutionContext>,
  options: TtscBuildOptions,
): string[] {
  const args = [
    "check",
    "--tsconfig=" + execution.tsconfig,
    "--plugins-json=" + serializeNativePlugins(execution.nativePlugins),
    "--cwd=" + execution.projectRoot,
  ];
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

function createNativeOutputArgs(
  execution: ReturnType<typeof resolveExecutionContext>,
  options: TtscBuildOptions,
  file: string,
): string[] {
  const args = [
    "output",
    "--file=" + file,
    "--tsconfig=" + execution.tsconfig,
    "--plugins-json=" + serializeNativePlugins(execution.nativePlugins),
    "--cwd=" + execution.projectRoot,
  ];
  if (options.outDir) {
    args.push("--outDir=" + path.resolve(execution.cwd, options.outDir));
  }
  return args;
}

function serializeNativePlugins(
  plugins: readonly ITtscLoadedNativePlugin[],
): string {
  return JSON.stringify(
    plugins.map((plugin) => ({
      config: plugin.config,
      name: plugin.name,
      stage: plugin.stage,
    })),
  );
}

function runNativeCheckPlugins(
  options: TtscBuildOptions,
  execution: ReturnType<typeof resolveExecutionContext>,
): TtscBuildResult {
  let out: TtscBuildResult = {
    diagnostics: [],
    status: 0,
    stdout: "",
    stderr: "",
  };
  for (const plugin of execution.nativePlugins.filter(
    (plugin) => plugin.stage === "check",
  )) {
    const result = runNativePluginCommand(
      plugin,
      createNativeCheckArgs(execution, options),
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

function applyOutputPlugins(
  options: TtscBuildOptions,
  execution: ReturnType<typeof resolveExecutionContext>,
  emittedFiles: readonly string[],
  plugins: readonly ITtscLoadedNativePlugin[],
): TtscBuildResult {
  let out: TtscBuildResult = {
    diagnostics: [],
    status: 0,
    stdout: "",
    stderr: "",
  };
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
  options: TtscBuildOptions,
  execution: ReturnType<typeof resolveExecutionContext>,
  plugin: ITtscLoadedNativePlugin,
  file: string,
): TtscBuildResult {
  return runNativePluginCommand(
    plugin,
    createNativeOutputArgs(execution, options, file),
    options,
    execution,
    "ttsc.output",
  );
}

function runNativePluginCommand(
  plugin: ITtscLoadedNativePlugin,
  args: readonly string[],
  options: TtscBuildOptions,
  execution: ReturnType<typeof resolveExecutionContext>,
  label: string,
): TtscBuildResult {
  const res = spawnBinary(plugin.binary, args, {
    cwd: execution.projectRoot,
    env: nativePluginEnv(options.env, execution),
    encoding: "utf8",
  });
  if (res.error) {
    throw new Error(
      `${label}: failed to spawn ${plugin.binary}: ${res.error.message}`,
    );
  }
  return normalizeFailedDiagnostics(
    {
      status: res.status ?? 1,
      stdout: outputText(res.stdout),
      stderr: outputText(res.stderr),
    },
    execution.projectRoot,
  );
}

function appendBuildOutput(
  left: TtscBuildResult,
  right: TtscBuildResult,
): TtscBuildResult {
  return normalizeFailedDiagnostics({
    diagnostics: [...left.diagnostics, ...right.diagnostics],
    emittedFiles:
      right.emittedFiles !== undefined ? right.emittedFiles : left.emittedFiles,
    status: right.status !== 0 ? right.status : left.status,
    stdout: left.stdout + right.stdout,
    stderr: left.stderr + right.stderr,
  });
}

function assertSingleCompilerHost(
  plugins: readonly ITtscLoadedNativePlugin[],
): void {
  const binaries = [...new Set(plugins.map((plugin) => plugin.binary))];
  if (binaries.length > 1) {
    throw new Error(
      "ttsc: multiple compiler native backends cannot share one emit pass; " +
        "use output-capability plugins for post-emit transforms",
    );
  }
}

function resolveExecutionContext(
  options: TtscCommonOptions & { tsconfig?: string },
) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const tsconfig = resolveProjectConfig({
    cwd,
    tsconfig: options.tsconfig,
  });
  const projectRoot = path.dirname(tsconfig);
  const tsgo = resolveTsgo({ ...options, cwd: projectRoot });
  const fallbackBinary = resolveBinary(options);
  const loaded = loadProjectPlugins({
    binary: fallbackBinary ?? "",
    cacheDir: options.cacheDir ?? options.env?.TTSC_CACHE_DIR,
    cwd,
    entries: options.plugins,
    tsconfig,
  });
  return {
    cwd,
    nativePlugins: loaded.nativePlugins,
    projectRoot,
    tsgo,
    tsconfig,
  };
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

type PartialBuildResult = Omit<TtscBuildResult, "diagnostics"> & {
  diagnostics?: ITtscCompilerDiagnostic[];
};

function normalizeFailedDiagnostics(
  result: PartialBuildResult,
  cwd?: string,
): TtscBuildResult {
  const diagnostics =
    result.diagnostics ?? parseCompilerDiagnostics(result, cwd);
  if (result.status === 0 || result.stderr.trim().length !== 0) {
    return { ...result, diagnostics };
  }
  if (result.stdout.trim().length === 0) {
    return { ...result, diagnostics };
  }
  return {
    diagnostics,
    emittedFiles: result.emittedFiles,
    status: result.status,
    stdout: "",
    stderr: result.stdout,
  };
}

function parseCompilerDiagnostics(
  result: Pick<TtscBuildResult, "stderr" | "stdout">,
  cwd: string | undefined,
): ITtscCompilerDiagnostic[] {
  const lines = stripAnsi(`${result.stderr}\n${result.stdout}`).split(/\r?\n/);
  const out: ITtscCompilerDiagnostic[] = [];
  let current: ITtscCompilerDiagnostic | undefined;
  for (const line of lines) {
    if (line.length === 0 || /^TSFILE:\s*/.test(line)) {
      continue;
    }
    if (/^Found\s+\d+\s+errors?/i.test(line)) {
      continue;
    }

    const diagnostic = parseDiagnosticLine(line, cwd);
    if (diagnostic !== null) {
      current = diagnostic;
      out.push(current);
      continue;
    }

    if (current !== undefined && /^\s+/.test(line)) {
      current.messageText += `\n${line.trimEnd()}`;
    }
  }
  return out;
}

function parseDiagnosticLine(
  line: string,
  cwd: string | undefined,
): ITtscCompilerDiagnostic | null {
  const fileMatch = line.match(
    /^(.+?)\((\d+),(\d+)\):\s+(error|warning|suggestion|message)\s+([A-Z]+)?(\d+|[A-Z][A-Z0-9_-]*):\s+(.+)$/i,
  );
  if (fileMatch) {
    return {
      category: normalizeDiagnosticCategory(fileMatch[4]!),
      character: Number(fileMatch[3]),
      code: normalizeDiagnosticCode(fileMatch[6]!),
      file: normalizeDiagnosticFile(fileMatch[1]!, cwd),
      line: Number(fileMatch[2]),
      messageText: fileMatch[7]!,
    };
  }

  const globalMatch = line.match(
    /^(error|warning|suggestion|message)\s+([A-Z]+)?(\d+|[A-Z][A-Z0-9_-]*):\s+(.+)$/i,
  );
  if (!globalMatch) {
    return null;
  }
  return {
    category: normalizeDiagnosticCategory(globalMatch[1]!),
    code: normalizeDiagnosticCode(globalMatch[3]!),
    file: null,
    messageText: globalMatch[4]!,
  };
}

function normalizeDiagnosticFile(file: string, cwd: string | undefined): string {
  if (path.isAbsolute(file) || cwd === undefined) {
    return file;
  }
  return path.resolve(cwd, file);
}

function normalizeDiagnosticCategory(
  value: string,
): ITtscCompilerDiagnostic.Category {
  const lowered = value.toLowerCase();
  return lowered === "warning" ||
    lowered === "suggestion" ||
    lowered === "message"
    ? lowered
    : "error";
}

function normalizeDiagnosticCode(value: string): number | string {
  return /^\d+$/.test(value) ? Number(value) : value;
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}
