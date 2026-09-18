import path from "node:path";
import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import type { TtscBuildOptions } from "../../../structures/internal/TtscBuildOptions";
import type { TtscCommonOptions } from "../../../structures/internal/TtscCommonOptions";
import { createNativeProjectContextArgs } from "../project/createNativeProjectContextArgs";
import { selectSharedHostPlugin } from "../sharedHost/selectSharedHostPlugin";
import type { BuildExecution } from "./BuildExecution";
import type { RunBuildOptions } from "./RunBuildOptions";
import { PassthroughFlags } from "./PassthroughFlags";

/**
 * The argv ttsc hands to a native plugin host.
 *
 * A native host speaks its own subcommands (`build`, `check`, `fix`, `format`,
 * `project-inputs`) and receives the project, the plugin list, and the
 * compiler flags as separate arguments rather than one tsgo command line.
 * Optional capabilities a host declares (threading, diagnostics timing) decide
 * which of ttsc's arguments it can accept, so an older host is never handed a
 * flag it would reject.
 */
export namespace NativePluginArguments {
/** Build the argument list for a native plugin `build`/`check` invocation. */
export function createNativeBuildArgs(
  execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
  options: RunBuildOptions,
  plugins: readonly ITtscLoadedNativePlugin[],
): string[] {
  const args = [
    options.emit === false ? "check" : "build",
    "--tsconfig=" + execution.tsconfig,
    "--plugins-json=" + serializeNativePlugins(plugins),
    "--cwd=" + execution.projectRoot,
  ];
  if (
    selectSharedHostPlugin(plugins).capabilities?.projectContextArgs === true
  ) {
    args.push(
      ...createNativeProjectContextArgs(
        execution.project,
        execution.pluginConfigDir,
      ),
    );
  }
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
  return args;
}

/** Build the argument list for a native plugin check/fix/format invocation. */
export function createNativeCheckArgs(
  execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
  options: TtscBuildOptions,
  plugin: ITtscLoadedNativePlugin,
): string[] {
  const args = [
    nativeCheckSubcommand(options),
    "--tsconfig=" + execution.tsconfig,
    "--plugins-json=" + serializeNativePlugins(execution.nativePlugins),
    "--cwd=" + execution.projectRoot,
  ];
  if (plugin.capabilities?.projectContextArgs === true) {
    args.push(
      ...createNativeProjectContextArgs(
        execution.project,
        execution.pluginConfigDir,
      ),
    );
  }
  if (options.outDir) {
    args.push("--outDir=" + path.resolve(execution.cwd, options.outDir));
  }
  if (options.quiet === false) {
    args.push("--verbose");
  } else if (options.quiet === true) {
    args.push("--quiet");
  }
  args.push(...createNativeCheckThreadingArgs(options, plugin));
  args.push(...createNativeCheckDiagnosticsArgs(options, plugin));
  return args;
}

/**
 * Build the argv of a native host's `project-inputs` query, which reports the
 * non-TypeScript files (documents, schemas, configs) the host's rules read, so
 * watch and cache invalidation can observe them.
 */
export function createNativeProjectInputsArgs(
  execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
  plugin: ITtscLoadedNativePlugin,
): string[] {
  const args = [
    "project-inputs",
    "--tsconfig=" + execution.tsconfig,
    "--plugins-json=" + serializeNativePlugins(execution.nativePlugins),
    "--cwd=" + execution.projectRoot,
  ];
  if (plugin.capabilities?.projectContextArgs === true) {
    args.push(
      ...createNativeProjectContextArgs(
        execution.project,
        execution.pluginConfigDir,
      ),
    );
  }
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
// opts in through `capabilities.threadingArgs`, so a third-party check-stage
// plugin keeps the strict-host behavior from ad3443a unless it declares the
// same contract. Transform-stage hosts are never reached by this path (they go
// through `createNativeBuildArgs`), so the typia/nestia regression remains
// pinned by `test_plugin_corpus_single_threaded_flag_does_not_break_a_native_plugin_build`.
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
 * `--checkers` directly and threads them into `loadProgram` (parse phase) and
 * `engine.SetSerial` (rule walk). Any other check-stage host that has not
 * declared the capability is treated as a third-party binary whose flag set is
 * unknown, matching the conservative default from commit ad3443a.
 *
 * The capability flag replaces the prior `plugin.name === "@ttsc/lint"` string
 * check: routing on a descriptor field instead of the plugin name lets the next
 * first-party check-stage plugin opt in without ttsc needing to learn its name.
 * See `ITtscPluginCapabilities` and issue #125 for the broader CLI-parser
 * cleanup this is the quick-win step of.
 */
function nativeHostAcceptsThreadingArgs(
  plugin: ITtscLoadedNativePlugin,
): boolean {
  return plugin.capabilities?.threadingArgs === true;
}

function createNativeCheckDiagnosticsArgs(
  options: TtscCommonOptions,
  plugin: ITtscLoadedNativePlugin,
): string[] {
  if (!nativeHostAcceptsDiagnosticsTiming(plugin)) return [];
  if (!PassthroughFlags.hasDiagnosticsFlag(options)) return [];
  return ["--diagnostics"];
}

function nativeHostAcceptsDiagnosticsTiming(
  plugin: ITtscLoadedNativePlugin,
): boolean {
  return plugin.capabilities?.diagnosticsTiming === true;
}

/**
 * The `--diagnostics` timing label of one transform-host run, naming every
 * plugin that shared the host so a slow run can be attributed.
 */
export function transformHostTimingLabel(
  plugins: readonly ITtscLoadedNativePlugin[],
): string {
  return (
    `ttsc transform host [` +
    `${plugins.map((plugin) => plugin.name).join(", ")}] time`
  );
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
export function serializeNativePlugins(
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
}
