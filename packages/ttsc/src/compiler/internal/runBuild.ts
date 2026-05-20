import path from "node:path";

import { loadProjectPlugins } from "../../plugin/internal/loadProjectPlugins";
import type { ITtscCompilerDiagnostic } from "../../structures/ITtscCompilerDiagnostic";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { TtscBuildOptions } from "../../structures/internal/TtscBuildOptions";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";
import { resolveProjectConfig } from "./project/resolveProjectConfig";
import { resolveBinary } from "./resolveBinary";
import { resolveTsgo } from "./resolveTsgo";
import {
  assertSharedHostCompatibility,
  linkedTransformPlugins,
  selectSharedHostPlugin,
} from "./sharedHostHelpers";
import { outputText, spawnNative } from "./spawnNative";

/**
 * Merge extra environment variables over `process.env`, always injecting
 * `TTSC_NODE_BINARY` so child processes can re-invoke the same Node.js binary
 * without searching `PATH`.
 */
function mergeEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const base = {
    ...process.env,
    TTSC_NODE_BINARY: process.env.TTSC_NODE_BINARY ?? process.execPath,
  };
  if (!extra) return base;
  return { ...base, ...extra };
}

/**
 * Build the environment for a native plugin spawn. Injects `TTSC_TSGO_BINARY`
 * and `TTSC_TTSX_BINARY` alongside the base env from `mergeEnv`. For
 * transform-stage plugins, also passes `TTSC_LINKED_PLUGINS_JSON` containing
 * any linked sources so they run inside the same process as the host plugin.
 */
function nativePluginEnv(
  extra: NodeJS.ProcessEnv | undefined,
  execution: ReturnType<typeof resolveExecutionContext>,
  plugin?: ITtscLoadedNativePlugin,
): NodeJS.ProcessEnv {
  const env = mergeEnv({
    TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? execution.tsgo.binary,
    TTSC_TTSX_BINARY:
      process.env.TTSC_TTSX_BINARY ??
      path.join(__dirname, "..", "..", "launcher", "ttsx.js"),
    ...extra,
  });
  if (plugin?.stage === "transform") {
    const linked = linkedTransformPlugins(execution.nativePlugins);
    if (linked.length !== 0) {
      env.TTSC_LINKED_PLUGINS_JSON = serializeNativePlugins(linked);
    }
  }
  return env;
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
    const checked = runNativeCheckPlugins(options, execution);
    if (checked.status !== 0) {
      return checked;
    }

    if (options.emit === false) {
      if (options.format === true) {
        // Format mode is write-only by contract: the lint sidecar
        // already rewrote source files and reported nothing. Running
        // tsgo --noEmit OR a transform compiler afterwards would either
        // surface unrelated type errors as if they were format failures
        // (tsgo path) or apply transform-stage rewrites on top of the
        // formatted source (transform path), both of which break the
        // documented "ttsc format only formats" guarantee. The
        // short-circuit fires before either branch so format mode is a
        // single concern regardless of how many compilers the project
        // configures. Callers that want a recheck or a transform pass
        // after format should run `ttsc check` / `ttsc build` as a
        // separate invocation.
        return checked;
      }
      if (compilers.length !== 0) {
        assertSharedHostCompatibility(compilers, "emit");
        return appendBuildOutput(
          checked,
          buildWithNativeCompilerPlugins(options, execution, compilers),
        );
      }
      return appendBuildOutput(
        checked,
        runTsgo(execution, ["--noEmit"], options),
      );
    }

    let result: TtscBuildResult;
    if (compilers.length !== 0) {
      assertSharedHostCompatibility(compilers, "emit");
      result = appendBuildOutput(
        checked,
        buildWithNativeCompilerPlugins(options, execution, compilers),
      );
    } else {
      if (options.skipDiagnosticsCheck !== true) {
        const tsgoChecked = runTsgo(execution, ["--noEmit"], options);
        if (tsgoChecked.status !== 0) {
          return appendBuildOutput(checked, tsgoChecked);
        }
      }
      const args = createTsgoBuildArgs(execution, options, {
        listEmittedFiles: options.forceListEmittedFiles === true,
      });
      const emitted = runTsgoBuild(execution, options, args);
      result = appendBuildOutput(checked, emitted);
    }

    return result;
  }

  if (options.format === true) {
    // Format mode is write-only by contract — see the matching
    // short-circuit in the with-native-plugins branch above. When no
    // native plugin is loaded there is nothing for `ttsc format` to
    // rewrite, so emit an empty success result rather than falling
    // through to a tsgo pass that would surface unrelated type errors
    // as if they were format failures.
    return {
      diagnostics: [],
      status: 0,
      stdout: "",
      stderr: "",
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
      options.emit !== false && options.forceListEmittedFiles === true,
  });
  return runTsgoBuild(execution, options, args);
}

/**
 * Dispatch a build through the shared-host native plugin. The host plugin is
 * the one that owns the process (non-linked); all other transform plugins ride
 * inside it via the `--plugins-json` flag.
 */
function buildWithNativeCompilerPlugins(
  options: TtscBuildOptions,
  execution: ReturnType<typeof resolveExecutionContext>,
  plugins: readonly ITtscLoadedNativePlugin[],
): TtscBuildResult {
  const host = selectSharedHostPlugin(plugins);
  return runNativePluginCommand(
    host,
    createNativeBuildArgs(execution, options, plugins),
    options,
    execution,
    "ttsc.build",
  );
}

/**
 * Run `tsgo -p <tsconfig> [extraArgs]` and return the normalized result. Used
 * for the no-emit type-check pass that precedes file emission.
 */
function runTsgo(
  execution: ReturnType<typeof resolveExecutionContext>,
  extraArgs: readonly string[],
  options: NonNullable<Parameters<typeof runBuild>[0]>,
): TtscBuildResult {
  const res = spawnNative(
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
  return normalizeBuildOutput(
    {
      status: res.status ?? 1,
      stdout: outputText(res.stdout),
      stderr: outputText(res.stderr),
    },
    execution.projectRoot,
  );
}

/**
 * Run `tsgo` with the full emit arguments and parse `TSFILE:` lines from stdout
 * into `emittedFiles`. The TSFILE lines are stripped before the result is
 * returned so they do not appear in the user-facing output.
 */
function runTsgoBuild(
  execution: ReturnType<typeof resolveExecutionContext>,
  options: NonNullable<Parameters<typeof runBuild>[0]>,
  args: readonly string[],
): TtscBuildResult {
  const res = spawnNative(execution.tsgo.binary, args, {
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
  return normalizeBuildOutput(
    { ...result, emittedFiles },
    execution.projectRoot,
  );
}

/** Build the argument list for a direct `tsgo` build invocation. */
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

/**
 * Return `["--pretty", "false"]` when structured diagnostics are requested so
 * that the output can be parsed line-by-line, or an empty array otherwise.
 */
function createTsgoDiagnosticArgs(options: TtscCommonOptions): string[] {
  return options.structuredDiagnostics === true ? ["--pretty", "false"] : [];
}

/** Build the argument list for a native plugin `build`/`check` invocation. */
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

/** Build the argument list for a native plugin check/fix/format invocation. */
function createNativeCheckArgs(
  execution: ReturnType<typeof resolveExecutionContext>,
  options: TtscBuildOptions,
): string[] {
  const args = [
    nativeCheckSubcommand(options),
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

/**
 * Decide which native plugin subcommand the lint sidecar should run for the
 * current `runBuild` invocation. The launcher selects exactly one of `fix` /
 * `format` / `check` via subcommand dispatch, so at most one of the
 * `options.fix` / `options.format` booleans is true.
 */
function nativeCheckSubcommand(options: TtscBuildOptions): string {
  if (options.format === true) return "format";
  if (options.fix === true) return "fix";
  return "check";
}

/**
 * Serialize the plugin list to a compact JSON string for `--plugins-json=`.
 * Only the fields the native binary protocol requires are included.
 */
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

/**
 * Run every check-stage plugin in order, short-circuiting on the first non-zero
 * exit. Aggregates diagnostics and output across all check plugins.
 */
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

/**
 * Spawn a single native plugin binary with the given args and return the
 * normalized build result. `label` is used in the thrown error message so the
 * caller's context (e.g. `"ttsc.check"` or `"ttsc.build"`) is preserved.
 */
function runNativePluginCommand(
  plugin: ITtscLoadedNativePlugin,
  args: readonly string[],
  options: TtscBuildOptions,
  execution: ReturnType<typeof resolveExecutionContext>,
  label: string,
): TtscBuildResult {
  const res = spawnNative(plugin.binary, args, {
    cwd: execution.projectRoot,
    env: nativePluginEnv(options.env, execution, plugin),
    encoding: "utf8",
  });
  if (res.error) {
    throw new Error(
      `${label}: failed to spawn ${plugin.binary}: ${res.error.message}`,
    );
  }
  return normalizeBuildOutput(
    {
      status: res.status ?? 1,
      stdout: outputText(res.stdout),
      stderr: outputText(res.stderr),
    },
    execution.projectRoot,
  );
}

/**
 * Merge two `TtscBuildResult` values into one.
 *
 * - `status`: the right status wins unless it is 0 (failure propagates).
 * - `diagnostics`: concatenated left then right.
 * - `emittedFiles`: right wins when present, otherwise left is kept.
 * - `stdout`/`stderr`: concatenated left then right.
 */
export function appendBuildOutput(
  left: TtscBuildResult,
  right: TtscBuildResult,
): TtscBuildResult {
  return normalizeBuildOutput({
    diagnostics: [...left.diagnostics, ...right.diagnostics],
    emittedFiles:
      right.emittedFiles !== undefined ? right.emittedFiles : left.emittedFiles,
    status: right.status !== 0 ? right.status : left.status,
    stdout: left.stdout + right.stdout,
    stderr: left.stderr + right.stderr,
  });
}

/**
 * Resolve all runtime context needed for a build: cwd, tsconfig path, project
 * root, tsgo binary location, and the loaded native plugin list. Centralised
 * here so every code path in `runBuild` shares the same resolution logic.
 */
function resolveExecutionContext(
  options: TtscCommonOptions & { tsconfig?: string },
) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const tsconfig = resolveProjectConfig({
    cwd,
    tsconfig: options.tsconfig,
  });
  const projectRoot = options.projectRoot
    ? path.resolve(cwd, options.projectRoot)
    : path.dirname(tsconfig);
  const tsgo = resolveTsgo({ ...options, cwd: projectRoot });
  const fallbackBinary = resolveBinary(options);
  const loaded = loadProjectPlugins({
    binary: fallbackBinary ?? "",
    cacheDir: options.cacheDir ?? options.env?.TTSC_CACHE_DIR,
    cwd,
    entries: options.plugins,
    projectRoot,
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

/**
 * Extract `TSFILE: <path>` lines from tsgo stdout and return the absolute
 * paths. tsgo emits these when `--listEmittedFiles` is passed.
 */
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

/**
 * Remove `TSFILE:` lines from tsgo stdout so they do not appear in the
 * user-facing output after they have been parsed into `emittedFiles`.
 */
function stripEmittedFileLines(stdout: string): string {
  return stdout
    .split(/\r?\n/)
    .filter((line) => !/^TSFILE:\s*/.test(line))
    .join("\n")
    .replace(/\n+$/, "");
}

/**
 * `TtscBuildResult` with `diagnostics` made optional. Used internally when
 * diagnostics are parsed lazily from stdout/stderr by `normalizeBuildOutput`.
 */
type PartialBuildResult = Omit<TtscBuildResult, "diagnostics"> & {
  diagnostics?: ITtscCompilerDiagnostic[];
};

/**
 * Normalise a raw spawn result into a `TtscBuildResult`.
 *
 * When `diagnostics` is absent they are parsed from the text output. When the
 * process exited non-zero but stderr is empty and stdout is non-empty, stdout
 * is moved to stderr so the error is visible to callers who only check stderr.
 */
export function normalizeBuildOutput(
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

/**
 * Parse structured diagnostics from the combined stderr+stdout text when the
 * caller did not supply pre-parsed diagnostics. ANSI escape codes are stripped
 * and `TSFILE:` / `Found N errors` summary lines are skipped.
 */
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

/**
 * Try to parse a single line as a TypeScript compiler diagnostic in one of
 * three formats:
 *
 * - `file:line:col - category TSxxxx: message` (colon-separated, tsgo style)
 * - `file(line,col): category TSxxxx: message` (paren style, classic tsc)
 * - `category TSxxxx: message` (global, no file)
 *
 * Returns `null` when the line does not match any format.
 */
function parseDiagnosticLine(
  line: string,
  cwd: string | undefined,
): ITtscCompilerDiagnostic | null {
  const colonMatch = line.match(
    /^(.+):(\d+):(\d+)\s+-\s+(error|warning|suggestion|message)\s+([A-Z]+)?(\d+|[A-Z][A-Z0-9_-]*):\s+(.+)$/i,
  );
  if (colonMatch) {
    return {
      category: normalizeDiagnosticCategory(colonMatch[4]!),
      character: Number(colonMatch[3]),
      code: normalizeDiagnosticCode(colonMatch[6]!),
      file: normalizeDiagnosticFile(colonMatch[1]!, cwd),
      line: Number(colonMatch[2]),
      messageText: colonMatch[7]!,
    };
  }

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

/**
 * Return an absolute file path. When `file` is already absolute it is returned
 * unchanged; relative paths are resolved against `cwd` when available.
 */
function normalizeDiagnosticFile(
  file: string,
  cwd: string | undefined,
): string {
  if (path.isAbsolute(file) || cwd === undefined) {
    return file;
  }
  return path.resolve(cwd, file);
}

/**
 * Map a raw category string (`"error"`, `"warning"`, `"suggestion"`,
 * `"message"`) to the canonical `ITtscCompilerDiagnostic.Category`. Any
 * unrecognised value is coerced to `"error"`.
 */
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

/**
 * Parse a diagnostic code as a number when it is all digits (TS numeric codes
 * like `2322`), or keep it as a string for plugin-defined alphanumeric codes.
 */
function normalizeDiagnosticCode(value: string): number | string {
  return /^\d+$/.test(value) ? Number(value) : value;
}

/** Strip ANSI escape sequences from `text` for line-by-line diagnostic parsing. */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}
