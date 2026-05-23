import path from "node:path";

import { INTERNAL_SHADOW_FLAGS, TERMINAL_FLAGS } from "../../flags/schema";
import {
  hasProjectPluginEntries,
  loadProjectPlugins,
} from "../../plugin/internal/loadProjectPlugins";
import type { ITtscCompilerDiagnostic } from "../../structures/ITtscCompilerDiagnostic";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { TtscBuildOptions } from "../../structures/internal/TtscBuildOptions";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";
import { readProjectConfig } from "./project/readProjectConfig";
import { resolveBinary } from "./resolveBinary";
import { resolveTsgo } from "./resolveTsgo";
import {
  assertSharedHostCompatibility,
  linkedTransformPlugins,
  selectSharedHostPlugin,
} from "./sharedHostHelpers";
import { outputText, spawnNative } from "./spawnNative";

type RunBuildOptions = TtscBuildOptions & {
  skipDiagnosticsCheck?: boolean;
  forceListEmittedFiles?: boolean;
};

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
export function runBuild(options: RunBuildOptions = {}): TtscBuildResult {
  const execution = resolveExecutionContext(options);
  const buildOptions = applyProjectNoEmit(options, execution);
  if (execution.nativePlugins.length > 0) {
    const compilers = execution.nativePlugins.filter(
      (plugin) => plugin.stage === "transform",
    );
    const checked = runNativeCheckPlugins(buildOptions, execution);
    if (checked.status !== 0) {
      return checked;
    }

    if (buildOptions.emit === false) {
      if (buildOptions.format === true) {
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
          buildWithNativeCompilerPlugins(buildOptions, execution, compilers),
        );
      }
      if (checkPluginsReportTypeScriptDiagnostics(execution.nativePlugins)) {
        return checked;
      }
      return appendBuildOutput(
        checked,
        runTsgo(execution, ["--noEmit"], buildOptions),
      );
    }

    let result: TtscBuildResult;
    if (compilers.length !== 0) {
      assertSharedHostCompatibility(compilers, "emit");
      result = appendBuildOutput(
        checked,
        buildWithNativeCompilerPlugins(buildOptions, execution, compilers),
      );
    } else {
      if (
        buildOptions.skipDiagnosticsCheck !== true &&
        !checkPluginsReportTypeScriptDiagnostics(execution.nativePlugins) &&
        !forwardsTerminalTsgoFlag(buildOptions)
      ) {
        const tsgoChecked = runTsgo(execution, ["--noEmit"], buildOptions);
        if (tsgoChecked.status !== 0) {
          return appendBuildOutput(checked, tsgoChecked);
        }
      }
      const args = createTsgoBuildArgs(execution, buildOptions, {
        listEmittedFiles: buildOptions.forceListEmittedFiles === true,
      });
      const emitted = runTsgoBuild(execution, buildOptions, args);
      result = appendBuildOutput(checked, emitted);
    }

    return result;
  }

  if (buildOptions.format === true) {
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

  const args = createTsgoBuildArgs(execution, buildOptions, {
    listEmittedFiles:
      buildOptions.emit !== false &&
      buildOptions.forceListEmittedFiles === true,
    noEmitOnError:
      buildOptions.emit !== false &&
      buildOptions.skipDiagnosticsCheck !== true &&
      !forwardsTerminalTsgoFlag(buildOptions),
  });
  return runTsgoBuild(execution, buildOptions, args);
}

/**
 * A tsconfig-level `noEmit: true` is an analysis-only build unless the user
 * explicitly asks `ttsc --emit` to override it. Treat it like CLI `--noEmit`
 * before composing tsgo/native-host arguments so ttsc does not add emit-only
 * guards around projects that cannot emit.
 */
function applyProjectNoEmit(
  options: RunBuildOptions,
  execution: ReturnType<typeof resolveExecutionContext>,
): RunBuildOptions {
  if (options.emit !== undefined || execution.projectNoEmit !== true) {
    return options;
  }
  return { ...options, emit: false };
}

function checkPluginsReportTypeScriptDiagnostics(
  plugins: readonly ITtscLoadedNativePlugin[],
): boolean {
  return plugins.some(
    (plugin) =>
      plugin.stage === "check" && plugin.reportsTypeScriptDiagnostics === true,
  );
}

/**
 * Tsgo CLI flags that make `tsgo` print something and exit instead of building
 * (`--showConfig`, `--listFilesOnly`, `--help`, …). ttsc must not add
 * build-only guard flags around these because the forwarded flag asks tsgo to
 * print something and exit instead of compiling the project.
 *
 * Schema-derived: the set is computed from `FLAG_SCHEMA[*].terminal === true`,
 * not hand-maintained next to runBuild. Adding a new terminal flag now means
 * editing `schema.ts` and re-running `pnpm format` — every layer learns about
 * it automatically.
 */
const TERMINAL_TSGO_FLAGS: ReadonlySet<string> = (() => {
  // Mirror the legacy hand-list: schema's terminal flags ∪ the `-?` alias
  // tsgo accepts (kept here because it is a tsgo synonym, not a ttsc flag).
  const out = new Set<string>(TERMINAL_FLAGS);
  out.add("-?");
  return out;
})();

/**
 * Report whether the caller forwarded a print-and-exit tsgo flag, so ttsc can
 * avoid adding compile-only flags to a command that is not going to compile.
 */
function forwardsTerminalTsgoFlag(options: TtscCommonOptions): boolean {
  return (
    options.passthrough?.some((flag) => TERMINAL_TSGO_FLAGS.has(flag)) ?? false
  );
}

/**
 * Report whether the caller forwarded a flag ttsc adds to tsgo internally —
 * e.g. `--listEmittedFiles` (ttsc adds it to learn emitted paths) or
 * `--noEmit` (ttsc adds it for the pre-emit type-check). When the user
 * also forwards the same flag, post-processing must keep the user-visible
 * effect intact instead of stripping it as ttsc-internal noise.
 *
 * Schema-derived: `FLAG_SCHEMA[*].internalShadow === true`. RC-2 from the
 * RCA (RCA section 3, `--listEmittedFiles` / `--showConfig` swallowed):
 * the per-flag `passthrough.includes("…")` check is now one structural
 * lookup against the schema, not one bespoke `if` per shadow flag.
 */
function forwardsInternalShadowFlag(
  options: TtscCommonOptions,
  flag: string,
): boolean {
  if (!INTERNAL_SHADOW_FLAGS.has(flag)) return false;
  const passthrough = options.passthrough;
  if (passthrough === undefined) return false;
  // Match both the bare form (`--pretty`) and the inline-value form
  // (`--pretty=true`). The launcher's parser preserves these shapes
  // verbatim, so a tolerant prefix compare is what we want — `passthrough`
  // never holds a stray substring that happens to start with the flag
  // because parser positional/passthrough sinks split on whitespace.
  const inlinePrefix = `${flag}=`;
  return passthrough.some(
    (token) => token === flag || token.startsWith(inlinePrefix),
  );
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
  options: RunBuildOptions,
): TtscBuildResult {
  const res = spawnNative(
    execution.tsgo.binary,
    [
      "-p",
      execution.tsconfig,
      ...extraArgs,
      ...createTsgoDiagnosticArgs(options),
      ...createTsgoThreadingArgs(options),
      ...(options.passthrough ?? []),
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
  options: RunBuildOptions,
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
  // The `TSFILE:` lines are tsgo's `--listEmittedFiles` output. ttsc adds that
  // flag internally to learn the emitted paths and strips the lines back out
  // as noise — but when the user themselves forwarded `--listEmittedFiles`,
  // the listing is what they asked for, so it must survive to stdout.
  // The lookup is schema-driven (FLAG_SCHEMA marks `--listEmittedFiles` with
  // `internalShadow: true`); see `forwardsInternalShadowFlag` for the RC-2
  // background.
  const userListedEmitted = forwardsInternalShadowFlag(
    options,
    "--listEmittedFiles",
  );
  if (emittedFiles.length !== 0 && !userListedEmitted) {
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
  options: RunBuildOptions,
  flags: { listEmittedFiles: boolean; noEmitOnError?: boolean },
): string[] {
  const args = ["-p", execution.tsconfig];
  if (options.emit === true) {
    args.push("--noEmit", "false", "--emitDeclarationOnly", "false");
    if (execution.rewriteRelativeImportExtensionsForEmit) {
      args.push("--rewriteRelativeImportExtensions");
    }
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
  args.push(...createTsgoThreadingArgs(options));
  args.push(...(options.passthrough ?? []));
  if (flags.noEmitOnError === true) {
    args.push("--noEmitOnError");
  }
  return args;
}

/**
 * Return `["--pretty", "false"]` when structured diagnostics are requested so
 * that the output can be parsed line-by-line, or an empty array otherwise.
 *
 * When the user explicitly forwarded `--pretty` (any value), the internal
 * `--pretty false` shadow is dropped so the user wins on the surface. ttsc's
 * own diagnostic parser will then see pretty-formatted output and fall back
 * to surfacing it verbatim — the RC-2 contract that `--pretty`'s
 * `internalShadow: true` flag in `FLAG_SCHEMA` declares. Without this guard
 * the order in `runTsgo` (internal flags first, passthrough last) would
 * still let the user's `--pretty true` override at the tsgo level, but ttsc
 * would have already committed to a structured-diagnostics post-process
 * that no longer matches the actual output.
 */
function createTsgoDiagnosticArgs(options: TtscCommonOptions): string[] {
  if (options.structuredDiagnostics !== true) return [];
  if (forwardsInternalShadowFlag(options, "--pretty")) return [];
  return ["--pretty", "false"];
}

/**
 * Forward the `--singleThreaded` / `--checkers` knobs to a `tsgo` invocation.
 * tsgo accepts both flags natively, so the no-plugin build lane only has to
 * pass them through; the type-check and emit passes share this so the checker
 * pool size stays consistent across both.
 */
function createTsgoThreadingArgs(options: TtscCommonOptions): string[] {
  const args: string[] = [];
  if (options.singleThreaded === true) {
    args.push("--singleThreaded");
  }
  if (options.checkers !== undefined) {
    args.push("--checkers", String(options.checkers));
  }
  return args;
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
  }
  if (options.outDir) {
    args.push("--outDir=" + path.resolve(execution.cwd, options.outDir));
  }
  // Third-party transform hosts already treat the `check` subcommand as a
  // quiet no-emit pass. Keep ttsc-owned build modifiers off that lane so older
  // strict hosts do not reject unknown optional flags before analysis starts.
  if (options.emit !== false) {
    if (options.quiet === false) {
      args.push("--verbose");
    } else if (options.quiet === true) {
      args.push("--quiet");
    }
  }
  args.push(...createNativeTsgoArgs(options));
  return args;
}

/** Build the argument list for a native plugin check/fix/format invocation. */
function createNativeCheckArgs(
  execution: ReturnType<typeof resolveExecutionContext>,
  options: TtscBuildOptions,
  plugin: ITtscLoadedNativePlugin,
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
  args.push(...createNativeCheckThreadingArgs(options, plugin));
  args.push(...createNativeTsgoArgs(options));
  return args;
}

// `--singleThreaded` / `--checkers` are forwarded to native check-stage hosts
// only when the host is one ttsc itself owns (currently `@ttsc/lint`). #113
// forwarded both flags as bare CLI tokens to every native sidecar, then
// commit ad3443a reverted that across the board because a third-party host
// built before #113 has no `singleThreaded` / `checkers` flag in its
// `flag.FlagSet` and would exit 2 on the unknown flag — so
// `ttsc --singleThreaded` failed deterministically on every typia/nestia
// transform-plugin project.
//
// The performance ceiling that caused, though, is real: format/check passes
// through the lint sidecar are dominated by parallel parse + parallel rule
// walk, and with the threading knob silently dropped, MT and ST runs of
// `ttsc format` produced identical wall-clock numbers — the benchmark cell
// became a non-measurement. The lint sidecar is built and shipped from this
// repo, accepts both flags via `parseSubcommandFlags`, and threads them down
// to `loadProgram` (parse phase) and `engine.SetSerial` (rule walk). The host
// is identified by name (`@ttsc/lint`) so a third-party check-stage plugin
// keeps the strict-host behavior from ad3443a; only the host we control gets
// the bare flag. Transform-stage hosts are never reached by this path
// (they go through `createNativeBuildArgs`), so the typia/nestia regression
// remains pinned by `test_plugin_corpus_single_threaded_flag_does_not_break_a_native_plugin_build`.
function createNativeCheckThreadingArgs(
  options: TtscCommonOptions,
  plugin: ITtscLoadedNativePlugin,
): string[] {
  if (!nativeHostAcceptsThreadingArgs(plugin)) return [];
  const args: string[] = [];
  if (options.singleThreaded === true) {
    args.push("--singleThreaded");
  }
  if (options.checkers !== undefined) {
    args.push("--checkers=" + String(options.checkers));
  }
  return args;
}

/**
 * Return true when the loaded native check-stage host has declared
 * `capabilities.threadingArgs` in its plugin descriptor.
 *
 * The lint sidecar (`packages/lint/src/index.ts::createTtscPlugin`) opts in
 * because its `parseSubcommandFlags` handler accepts `--singleThreaded` and
 * `--checkers` directly and threads them into `loadProgram` (parse phase)
 * and `engine.SetSerial` (rule walk). Any other check-stage host that has
 * not declared the capability is treated as a third-party binary whose flag
 * set is unknown, matching the conservative default from commit ad3443a.
 *
 * The capability flag replaces the prior `plugin.name === "@ttsc/lint"`
 * string check: routing on a descriptor field instead of the plugin name
 * lets the next first-party check-stage plugin opt in without ttsc needing
 * to learn its name. See `ITtscPluginCapabilities` and issue #125 for the
 * broader CLI-parser cleanup this is the quick-win step of.
 */
function nativeHostAcceptsThreadingArgs(
  plugin: ITtscLoadedNativePlugin,
): boolean {
  return plugin.capabilities?.threadingArgs === true;
}

/**
 * Forward the tsgo flags ttsc did not recognize to a native sidecar as one
 * JSON-encoded `--tsgo-args` flag. The sidecar replays them through tsgo's own
 * option parser onto `CompilerOptions`, so a flag like `ttsc --strict` reaches
 * a plugin build the same way it reaches the plain tsgo lane. Encoded as a
 * single token so the sidecars' unknown-flag filters keep it intact.
 */
function createNativeTsgoArgs(options: TtscCommonOptions): string[] {
  const passthrough = options.passthrough;
  if (passthrough === undefined || passthrough.length === 0) {
    return [];
  }
  return ["--tsgo-args=" + JSON.stringify(passthrough)];
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
  options: TtscCommonOptions & { emit?: boolean; tsconfig?: string },
) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const project = readProjectConfig({
    cwd,
    projectRoot: options.projectRoot,
    tsconfig: options.tsconfig,
  });
  const tsconfig = project.path;
  const projectRoot = project.root;
  const tsgo = resolveTsgo({ ...options, cwd: projectRoot });
  const hasPlugins = hasProjectPluginEntries(project, options.plugins);
  const loaded = hasPlugins
    ? loadProjectPlugins({
        binary: resolveBinary(options) ?? "",
        cacheDir: options.cacheDir ?? options.env?.TTSC_CACHE_DIR,
        cwd,
        entries: options.plugins,
        projectRoot,
        tsconfig,
      })
    : { nativePlugins: [] };
  return {
    cwd,
    nativePlugins: loaded.nativePlugins,
    projectNoEmit: project.compilerOptions.noEmit === true,
    projectRoot,
    rewriteRelativeImportExtensionsForEmit:
      options.emit === true &&
      project.compilerOptions.allowImportingTsExtensions === true,
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
