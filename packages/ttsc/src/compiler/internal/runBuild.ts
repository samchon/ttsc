import fs from "node:fs";
import path from "node:path";

import { resolveFlagSpec } from "../../flags/schema";
import {
  type ProjectInputPathIdentityContext,
  createProjectInputPathIdentityContext,
} from "../../internal/projectInputPathIdentity";
import {
  hasProjectPluginEntries,
  loadProjectPlugins,
} from "../../plugin/internal/loadProjectPlugins";
import type { ITtscCompilerDiagnostic } from "../../structures/ITtscCompilerDiagnostic";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectInputSnapshot } from "../../structures/internal/ITtscProjectInputSnapshot";
import type { TtscBuildOptions } from "../../structures/internal/TtscBuildOptions";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";
import { createNativeProjectContextArgs } from "./project/createNativeProjectContextArgs";
import { readProjectConfig } from "./project/readProjectConfig";
import {
  ResidentCheckProcess,
  type ResidentCheckRequest,
} from "./residentCheckProcess";
import { resolveBinary } from "./resolveBinary";
import { resolveTsgo } from "./resolveTsgo";
import {
  assertSharedHostCompatibility,
  linkedTransformPlugins,
  resolvePluginConfigDir,
  selectSharedHostPlugin,
} from "./sharedHostHelpers";
import { outputText, spawnNative } from "./spawnNative";

export type RunBuildOptions = TtscBuildOptions & {
  skipDiagnosticsCheck?: boolean;
  forceListEmittedFiles?: boolean;
  /** Keep every compiler-owned side product inside this private directory. */
  isolateOutputsTo?: string;
  /**
   * Receives selected native-plugin source roots after the project resolves.
   * The watch launcher uses these roots to invalidate a sidecar when its Go
   * implementation changes between rebuilds.
   */
  onWatchInputs?: (inputs: readonly string[]) => void;
  /**
   * Receives the reconciled project-rule filesystem dependency snapshot. Called
   * only by watch launchers; ordinary builds do not probe the optional sidecar
   * command.
   */
  onProjectInputs?: (inputs: ITtscProjectInputSnapshot) => void;
  /**
   * Emit an external source map from the direct tsgo build lane even when the
   * project configures none. Set by the ttsx runtime builds so a served emit
   * carries a map to inline under the source URL (issue #353). Applied only to
   * the plain tsgo emit — never forwarded to a native plugin host, whose own
   * emit honours the project's `sourceMap` setting.
   */
  forceRuntimeSourceMap?: boolean;
  /** Retain an already selected project's lexical identity across API lanes. */
  resolvedProject?: ITtscParsedProjectConfig;
};

type BuildTiming = {
  enabled: boolean;
  lines: string[];
  startedAt: bigint;
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

function createBuildTiming(options: TtscCommonOptions): BuildTiming {
  return {
    enabled: hasDiagnosticsFlag(options),
    lines: [],
    startedAt: process.hrtime.bigint(),
  };
}

function hasDiagnosticsFlag(options: TtscCommonOptions): boolean {
  return (
    hasEnabledPassthroughFlag(options, "--diagnostics") ||
    hasEnabledPassthroughFlag(options, "--extendedDiagnostics")
  );
}

function hasEnabledPassthroughFlag(
  options: TtscCommonOptions,
  flag: string,
): boolean {
  const passthrough = options.passthrough ?? [];
  for (let i = 0; i < passthrough.length; i++) {
    const token = passthrough[i]!;
    // Identity, not spelling: the user forwards their own casing and ttsc must
    // read `--DIAGNOSTICS` the way tsgo does.
    if (resolveFlagSpec(token)?.name !== flag) continue;
    const equalsIndex = token.indexOf("=");
    if (equalsIndex !== -1) {
      return token.slice(equalsIndex + 1).toLowerCase() !== "false";
    }
    if (i + 1 < passthrough.length && isBooleanLiteral(passthrough[i + 1]!)) {
      return passthrough[i + 1]!.toLowerCase() !== "false";
    }
    return true;
  }
  return false;
}

function recordTiming(
  timing: BuildTiming,
  label: string,
  startedAt: bigint,
): void {
  if (!timing.enabled) return;
  timing.lines.push(`${label}: ${formatTimingSeconds(hrtimeMs(startedAt))}`);
}

function appendTimingOutput(
  result: TtscBuildResult,
  timing: BuildTiming,
): TtscBuildResult {
  if (!timing.enabled) return result;
  const lines = [
    ...timing.lines,
    `ttsc total time: ${formatTimingSeconds(hrtimeMs(timing.startedAt))}`,
  ];
  return {
    ...result,
    stdout: appendStdout(result.stdout, lines.join("\n") + "\n"),
  };
}

function appendStdout(stdout: string, text: string): string {
  if (stdout.length === 0 || stdout.endsWith("\n")) return stdout + text;
  return `${stdout}\n${text}`;
}

function hrtimeMs(startedAt: bigint): number {
  return Number(process.hrtime.bigint() - startedAt) / 1e6;
}

function formatTimingSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}

/**
 * Build the environment for a native plugin spawn. Injects `TTSC_TSGO_BINARY`
 * and `TTSC_TTSX_BINARY` alongside the base env from `mergeEnv`, plus
 * `TTSC_PLUGIN_CONFIG_DIR` when the caller declared a plugin config anchor (an
 * embedder compiling through a generated wrapper tsconfig) so config-file
 * discovery walks the real project instead of the wrapper's temp-dir ancestry.
 * For transform-stage plugins, also passes `TTSC_LINKED_PLUGINS_JSON`
 * containing any linked sources so they run inside the same process as the host
 * plugin.
 */
function nativePluginEnv(
  extra: NodeJS.ProcessEnv | undefined,
  execution: ReturnType<typeof resolveExecutionContext>,
  plugin?: ITtscLoadedNativePlugin,
): NodeJS.ProcessEnv {
  const env = mergeEnv({
    ...(execution.pluginConfigDir === undefined
      ? {}
      : { TTSC_PLUGIN_CONFIG_DIR: execution.pluginConfigDir }),
    TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? execution.tsgo.binary,
    TTSC_TTSX_BINARY:
      process.env.TTSC_TTSX_BINARY ??
      path.join(__dirname, "..", "..", "launcher", "ttsx.js"),
    ...extra,
  });
  // The anchor is per-invocation state owned by this host: when this run
  // declared none (and the caller's env does not name one), drop any value
  // inherited from an ancestor ttsc process so a nested build never
  // mis-anchors its plugins at the outer project.
  if (
    execution.pluginConfigDir === undefined &&
    extra?.TTSC_PLUGIN_CONFIG_DIR === undefined
  ) {
    delete env.TTSC_PLUGIN_CONFIG_DIR;
  }
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
  const timing = createBuildTiming(options);
  const result = runBuildTimed(options, timing);
  return appendTimingOutput(result, timing);
}

export type ResidentCheckWatchChange = {
  /** Re-resolve project, plugin, contributor, and Program topology. */
  reload?: boolean;
  /** Retain the sidecar and execution selection but cold-load its Program. */
  invalidate?: boolean;
  /** Local compiler or data paths changed since the prior cycle. */
  changed?: readonly string[];
  /** Subset of changed paths declared by ProjectRules as external inputs. */
  external?: readonly string[];
};

/**
 * Analysis-only watch coordinator.
 *
 * The selected project and compatible check-stage processes stay resident
 * across ordinary source/data edits. A config, root-set, contributor, or plugin
 * topology transition calls for a full reset before the next cycle. Emit and
 * transform lanes can pass through the coordinator, but compatibility checks
 * keep them on the established one-shot path without starting sidecars.
 */
export class ResidentCheckWatchSession {
  private execution: ReturnType<typeof resolveExecutionContext> | undefined;
  private readonly pendingChanges = new Map<number, ResidentCheckRequest>();
  private projectInputs: ITtscProjectInputSnapshot | undefined;
  private readonly processes = new Map<string, ResidentCheckProcess>();

  public async run(
    options: RunBuildOptions,
    change: ResidentCheckWatchChange = {},
  ): Promise<TtscBuildResult> {
    if (change.reload === true) this.reset();

    const timing = createBuildTiming(options);
    const projectFree = runProjectFreeTerminalFlag(options);
    if (projectFree !== null) {
      this.reset();
      return appendTimingOutput(projectFree, timing);
    }

    let execution = this.execution;
    const reusedExecution = execution !== undefined;
    let buildOptions: RunBuildOptions;
    if (execution === undefined) {
      const setupStartedAt = process.hrtime.bigint();
      execution = resolveExecutionContext(options);
      const discoveryOptions = this.captureProjectInputs(options);
      const prepared = prepareBuildExecution(
        discoveryOptions,
        timing,
        execution,
        setupStartedAt,
      );
      buildOptions = prepared.buildOptions;
      if (prepared.result !== undefined) {
        this.reset();
        return appendTimingOutput(prepared.result, timing);
      }
      if (!residentCheckExecutionIsCompatible(buildOptions, execution)) {
        this.reset();
        return appendTimingOutput(
          runPreparedBuild(options, timing, execution, buildOptions),
          timing,
        );
      }
      this.execution = execution;
    } else {
      buildOptions = applyProjectNoEmit(options, execution);
    }
    if (
      reusedExecution &&
      this.refreshProjectInputTopology(options, execution)
    ) {
      this.reset();
      return this.run(options);
    }

    const checked = await this.runCheckPlugins(
      buildOptions,
      execution,
      timing,
      change,
    );
    let result: TtscBuildResult;
    if (checked.status !== 0) {
      result = appendTypeScriptDiagnosticsAfterPluginFailure(
        checked,
        buildOptions,
        execution,
      );
    } else if (
      checkPluginsReportTypeScriptDiagnostics(execution.nativePlugins)
    ) {
      result = checked;
    } else {
      result = appendBuildOutput(
        checked,
        runTsgo(execution, ["--noEmit"], buildOptions),
      );
    }
    return appendTimingOutput(result, timing);
  }

  /** Terminate every sidecar and discard the cached selection context. */
  public dispose(): void {
    this.reset();
  }

  private reset(): void {
    for (const process of this.processes.values()) process.dispose();
    this.processes.clear();
    this.pendingChanges.clear();
    this.execution = undefined;
    this.projectInputs = undefined;
  }

  private captureProjectInputs(options: RunBuildOptions): RunBuildOptions {
    const onProjectInputs = options.onProjectInputs;
    if (onProjectInputs === undefined) return options;
    return {
      ...options,
      onProjectInputs: (snapshot) => {
        this.projectInputs = snapshot;
        onProjectInputs(snapshot);
      },
    };
  }

  private refreshProjectInputTopology(
    options: RunBuildOptions,
    execution: ReturnType<typeof resolveExecutionContext>,
  ): boolean {
    if (options.onProjectInputs === undefined) return false;
    const next = discoverNativeProjectInputs(options, execution);
    const changed =
      this.projectInputs !== undefined &&
      !projectInputSnapshotsEqual(this.projectInputs, next);
    this.projectInputs = next;
    options.onProjectInputs(next);
    return changed;
  }

  private async runCheckPlugins(
    options: RunBuildOptions,
    execution: ReturnType<typeof resolveExecutionContext>,
    timing: BuildTiming,
    change: ResidentCheckWatchChange,
  ): Promise<TtscBuildResult> {
    let out: TtscBuildResult = {
      diagnostics: [],
      status: 0,
      stderr: "",
      stdout: "",
    };
    const checks = planResidentCheckEntries(execution.nativePlugins, (plugin) =>
      createNativeCheckArgs(execution, options, plugin),
    );
    const request = residentCheckRequest(change, execution.projectRoot);
    // Buffer the cycle for every resident plugin before running any of them.
    // An earlier plugin may fail and short-circuit diagnostics, but a later
    // sidecar must still receive every filesystem transition when it resumes.
    bufferResidentCheckEntryRequests(this.pendingChanges, checks, request);

    for (const { args, entryIndex, key, plugin } of checks) {
      let result: TtscBuildResult;
      if (key === undefined) {
        result = runNativePluginCommand(
          plugin,
          args,
          options,
          execution,
          "ttsc.check",
          timing,
          `ttsc check plugin ${plugin.name} time`,
        );
      } else {
        const startedAt = process.hrtime.bigint();
        let resident = this.processes.get(key);
        if (resident === undefined) {
          resident = new ResidentCheckProcess({
            args: ["check-serve", ...args.slice(1)],
            binary: plugin.binary,
            cwd: execution.projectRoot,
            env: nativePluginEnv(options.env, execution, plugin),
          });
          this.processes.set(key, resident);
        }
        try {
          const reply = await resident.request(
            takeResidentCheckEntryRequest(this.pendingChanges, entryIndex),
          );
          result = normalizeBuildOutput(
            {
              status: reply.status,
              stderr: reply.stderr,
              stdout: reply.stdout,
            },
            execution.projectRoot,
          );
        } catch {
          resident.dispose();
          this.processes.delete(key);
          // The one-shot fallback observes the complete current filesystem,
          // and a later sidecar starts cold, so neither needs old deltas.
          // A capability-aware host may still disappear or violate framing.
          // Preserve correctness by running the established one-shot command
          // for this cycle; the next cycle gets one clean respawn attempt.
          result = runNativePluginCommand(
            plugin,
            args,
            options,
            execution,
            "ttsc.check",
            { ...timing, enabled: false },
            "",
          );
        }
        recordTiming(
          timing,
          `ttsc check plugin ${plugin.name} time`,
          startedAt,
        );
      }
      out = appendBuildOutput(out, result);
      if (result.status !== 0) return out;
    }
    return out;
  }
}

function projectInputSnapshotsEqual(
  left: ITtscProjectInputSnapshot,
  right: ITtscProjectInputSnapshot,
): boolean {
  const leftReloadFiles = left.reloadFiles ?? [];
  const rightReloadFiles = right.reloadFiles ?? [];
  const leftReloadDirectories = left.reloadDirectories ?? [];
  const rightReloadDirectories = right.reloadDirectories ?? [];
  return (
    left.root === right.root &&
    left.files.length === right.files.length &&
    left.globs.length === right.globs.length &&
    leftReloadDirectories.length === rightReloadDirectories.length &&
    leftReloadFiles.length === rightReloadFiles.length &&
    left.files.every((value, index) => value === right.files[index]) &&
    left.globs.every((value, index) => value === right.globs[index]) &&
    leftReloadDirectories.every(
      (value, index) => value === rightReloadDirectories[index],
    ) &&
    leftReloadFiles.every((value, index) => value === rightReloadFiles[index])
  );
}

function residentCheckExecutionIsCompatible(
  options: RunBuildOptions,
  execution: ReturnType<typeof resolveExecutionContext>,
): boolean {
  return (
    options.emit === false &&
    options.fix !== true &&
    options.format !== true &&
    forwardsTerminalTsgoFlag(options) === false &&
    execution.nativePlugins.every((plugin) => plugin.stage === "check")
  );
}

function residentCheckProcessKey(
  plugin: ITtscLoadedNativePlugin,
  args: readonly string[],
): string {
  return `${plugin.binary}\0${plugin.name}\0${JSON.stringify(args)}`;
}

export type ResidentCheckEntryPlan = {
  args: string[];
  entryIndex: number;
  key: string | undefined;
  plugin: ITtscLoadedNativePlugin;
};

/**
 * Plan every configured check entry while sharing resident processes only by
 * binary/name/argument identity.
 */
export function planResidentCheckEntries(
  plugins: readonly ITtscLoadedNativePlugin[],
  createArgs: (plugin: ITtscLoadedNativePlugin) => string[],
): ResidentCheckEntryPlan[] {
  return plugins
    .filter((candidate) => candidate.stage === "check")
    .map((plugin, entryIndex) => {
      const args = createArgs(plugin);
      return {
        args,
        entryIndex,
        key:
          plugin.capabilities?.residentCheck === true
            ? residentCheckProcessKey(plugin, args)
            : undefined,
        plugin,
      };
    });
}

/** Retain one complete change stream per configured resident check entry. */
export function bufferResidentCheckEntryRequests(
  pending: Map<number, ResidentCheckRequest>,
  checks: readonly ResidentCheckEntryPlan[],
  request: ResidentCheckRequest,
): void {
  for (const check of checks) {
    if (check.key === undefined) continue;
    pending.set(
      check.entryIndex,
      mergeResidentCheckRequests(pending.get(check.entryIndex), request),
    );
  }
}

/** Consume exactly one configured entry's buffered request. */
export function takeResidentCheckEntryRequest(
  pending: Map<number, ResidentCheckRequest>,
  entryIndex: number,
): ResidentCheckRequest {
  const request = pending.get(entryIndex);
  if (request === undefined) {
    throw new Error(
      `ttsc: resident check entry ${String(entryIndex)} has no buffered request`,
    );
  }
  pending.delete(entryIndex);
  return request;
}

export function residentCheckRequest(
  change: ResidentCheckWatchChange,
  cwd: string,
): ResidentCheckRequest {
  const normalize = (values: readonly string[] | undefined): string[] =>
    [...new Set(values?.map((value) => path.resolve(cwd, value)) ?? [])].sort();
  const changed = normalize(change.changed);
  const external = normalize(change.external);
  return {
    ...(change.invalidate === true ? { invalidate: true } : {}),
    ...(changed.length === 0 ? {} : { changed }),
    ...(external.length === 0 ? {} : { external }),
  };
}

function mergeResidentCheckRequests(
  previous: ResidentCheckRequest | undefined,
  current: ResidentCheckRequest,
): ResidentCheckRequest {
  const merge = (
    left: readonly string[] | undefined,
    right: readonly string[] | undefined,
  ): string[] => [...new Set([...(left ?? []), ...(right ?? [])])].sort();
  const changed = merge(previous?.changed, current.changed);
  const external = merge(previous?.external, current.external);
  return {
    ...(changed.length === 0 ? {} : { changed }),
    ...(external.length === 0 ? {} : { external }),
    ...(previous?.invalidate === true || current.invalidate === true
      ? { invalidate: true }
      : {}),
  };
}

function runBuildTimed(
  options: RunBuildOptions,
  timing: BuildTiming,
): TtscBuildResult {
  const projectFree = runProjectFreeTerminalFlag(options);
  if (projectFree !== null) return projectFree;
  const setupStartedAt = process.hrtime.bigint();
  const execution = resolveExecutionContext(options);
  return runBuildWithExecution(options, timing, execution, setupStartedAt);
}

function runBuildWithExecution(
  options: RunBuildOptions,
  timing: BuildTiming,
  execution: ReturnType<typeof resolveExecutionContext>,
  setupStartedAt: bigint,
): TtscBuildResult {
  const prepared = prepareBuildExecution(
    options,
    timing,
    execution,
    setupStartedAt,
  );
  if (prepared.result !== undefined) return prepared.result;
  return runPreparedBuild(options, timing, execution, prepared.buildOptions);
}

function prepareBuildExecution(
  options: RunBuildOptions,
  timing: BuildTiming,
  execution: ReturnType<typeof resolveExecutionContext>,
  setupStartedAt: bigint,
): { buildOptions: RunBuildOptions; result?: TtscBuildResult } {
  if (
    execution.nativePlugins.length > 0 ||
    execution.pluginSetupFailure !== undefined
  ) {
    recordTiming(timing, "ttsc plugin setup time", setupStartedAt);
  }
  const buildOptions = applyProjectNoEmit(options, execution);
  if (execution.pluginSetupFailure !== undefined) {
    return {
      buildOptions,
      result: appendTypeScriptDiagnosticsAfterPluginFailure(
        execution.pluginSetupFailure,
        buildOptions,
        execution,
      ),
    };
  }
  if (options.onProjectInputs !== undefined) {
    options.onProjectInputs(discoverNativeProjectInputs(options, execution));
  }
  return { buildOptions };
}

function runPreparedBuild(
  options: RunBuildOptions,
  timing: BuildTiming,
  execution: ReturnType<typeof resolveExecutionContext>,
  buildOptions: RunBuildOptions,
): TtscBuildResult {
  if (execution.nativePlugins.length > 0) {
    const compilers = execution.nativePlugins.filter(
      (plugin) => plugin.stage === "transform",
    );
    const checked = runNativeCheckPlugins(buildOptions, execution, timing);
    if (checked.status !== 0) {
      return appendTypeScriptDiagnosticsAfterPluginFailure(
        checked,
        buildOptions,
        execution,
      );
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
        const compiled = buildWithNativeCompilerPlugins(
          buildOptions,
          execution,
          compilers,
          timing,
        );
        const result = appendBuildOutput(checked, compiled);
        return compiled.status === 0
          ? result
          : appendTypeScriptDiagnosticsAfterPluginFailure(
              result,
              buildOptions,
              execution,
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
      const compiled = buildWithNativeCompilerPlugins(
        buildOptions,
        execution,
        compilers,
        timing,
      );
      result = appendBuildOutput(checked, compiled);
      if (compiled.status !== 0) {
        result = appendTypeScriptDiagnosticsAfterPluginFailure(
          result,
          buildOptions,
          execution,
        );
      }
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
    // `--verbose` promises the emitted-file list on every lane, and the list
    // only exists if tsgo is asked for it. ttsc adds the flag for itself here
    // exactly as it does for `forceListEmittedFiles`, and strips the raw
    // `TSFILE:` lines back out below.
    listEmittedFiles:
      buildOptions.emit !== false &&
      (buildOptions.forceListEmittedFiles === true ||
        buildOptions.quiet === false),
    noEmitOnError:
      buildOptions.emit !== false &&
      buildOptions.skipDiagnosticsCheck !== true &&
      !forwardsTerminalTsgoFlag(buildOptions),
  });
  return runTsgoBuild(execution, buildOptions, args);
}

/**
 * Answer a forwarded terminal flag whose meaning precedes a project, when no
 * project can be resolved.
 *
 * `ttsc --init` exists to write the starter `tsconfig.json`, and `ttsc --all` /
 * `ttsc -?` only print tsgo's help — none of them needs a project, yet all
 * three died in project resolution because that layer ran first and
 * unconditionally. The classification is `FLAG_SCHEMA`'s (`terminal` +
 * `projectFree`), so marking a further flag project-free needs no edit here.
 *
 * A resolvable project keeps the established lane untouched: the build path
 * still forwards the flag with `-p <tsconfig>` from the project root, so `ttsc
 * --init` inside an existing project still reports tsgo's TS5054 instead of
 * writing a second config into the current directory. Returns `null` when this
 * lane does not apply.
 */
function runProjectFreeTerminalFlag(
  options: RunBuildOptions,
): TtscBuildResult | null {
  if (!forwardsProjectFreeTerminalTsgoFlag(options)) return null;
  if (options.resolvedProject !== undefined) return null;
  const cwd = path.resolve(options.cwd ?? process.cwd());
  try {
    readProjectConfig({
      cwd,
      projectRoot: options.projectRoot,
      tsconfig: options.tsconfig,
    });
    return null;
  } catch {
    // Any resolution failure takes this branch, not only "not found": a
    // malformed config and an explicitly named missing `-p` path are equally
    // beside the point for a flag whose meaning does not presuppose a project.
    // Forward it to tsgo from the invocation directory instead of failing.
  }
  const tsgo = resolveTsgo({ ...options, cwd });
  const res = spawnNative(tsgo.binary, [...(options.passthrough ?? [])], {
    cwd,
    env: mergeEnv(options.env),
    encoding: "utf8",
  });
  if (res.error) {
    throw new Error(
      `ttsc: failed to spawn ${tsgo.binary}: ${res.error.message}`,
    );
  }
  return normalizeBuildOutput(
    {
      status: res.status ?? 1,
      stdout: outputText(res.stdout),
      stderr: outputText(res.stderr),
    },
    cwd,
  );
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
 * Preserve a failed plugin's output and status while collecting TypeScript
 * diagnostics through an independent no-emit pass.
 *
 * A sidecar can fail before it loads the project Program, including when a Go
 * panic or another runtime error terminates the process. The plugin failure
 * must still block emit, but it must not hide unrelated errors in the user's
 * TypeScript source. The fallback runs only after a plugin failure, skips modes
 * whose contract intentionally omits diagnostics, and avoids appending a batch
 * the plugin already reported itself.
 */
function appendTypeScriptDiagnosticsAfterPluginFailure(
  failure: TtscBuildResult,
  options: RunBuildOptions,
  execution: ReturnType<typeof resolveExecutionContext>,
): TtscBuildResult {
  if (
    options.format === true ||
    options.skipDiagnosticsCheck === true ||
    forwardsTerminalTsgoFlag(options)
  ) {
    return failure;
  }
  const typechecked = runTsgo(
    execution,
    ["--noEmit"],
    createPluginFailureTypecheckOptions(options),
  );
  const fallback = filterReportedTypeScriptDiagnostics(
    failure,
    typechecked,
    execution.projectRoot,
  );
  if (fallback === null) {
    return failure;
  }
  // Structured consumers (the public API's `IFailure.diagnostics`) never see
  // stdout/stderr, so a plugin failure that reported no parsable diagnostics
  // must be seeded as one before recovered TypeScript diagnostics are appended
  // — otherwise the recovery would replace the plugin error with unrelated
  // type errors instead of surfacing both.
  const seeded =
    failure.diagnostics.length === 0
      ? { ...failure, diagnostics: [createProcessDiagnostic(failure)] }
      : failure;
  const status = failure.status;
  return {
    ...appendBuildOutput(seeded, fallback),
    status,
  };
}

/**
 * Make the recovery pass parseable regardless of the user's display flags. This
 * is an internal second pass, so plain output is required to remove only
 * diagnostics that the failed plugin already printed.
 */
function createPluginFailureTypecheckOptions(
  options: RunBuildOptions,
): RunBuildOptions {
  const passthrough: string[] = [];
  for (let i = 0; i < (options.passthrough?.length ?? 0); i++) {
    const token = options.passthrough![i]!;
    if (resolveFlagSpec(token)?.name === "--pretty") {
      // `--pretty` is boolean: it owns a following token only when that token
      // is the literal `true`/`false`, and the inline form carries its own.
      if (
        !token.includes("=") &&
        isBooleanLiteral(options.passthrough![i + 1] ?? "")
      ) {
        i++;
      }
      continue;
    }
    passthrough.push(token);
  }
  return {
    ...options,
    passthrough,
    structuredDiagnostics: true,
  };
}

/** Return only fallback diagnostics the failed plugin did not already report. */
function filterReportedTypeScriptDiagnostics(
  failure: TtscBuildResult,
  typechecked: TtscBuildResult,
  cwd: string,
): TtscBuildResult | null {
  if (typechecked.diagnostics.length === 0) {
    return typechecked.status === 0 ? null : typechecked;
  }
  const diagnostics = typechecked.diagnostics.filter(
    (diagnostic) =>
      !failure.diagnostics.some((existing) =>
        compilerDiagnosticsEqual(existing, diagnostic),
      ),
  );
  if (diagnostics.length === 0) return null;
  if (diagnostics.length === typechecked.diagnostics.length) return typechecked;
  return {
    ...typechecked,
    diagnostics,
    stderr: filterCompilerDiagnosticText(typechecked.stderr, diagnostics, cwd),
    stdout: filterCompilerDiagnosticText(typechecked.stdout, diagnostics, cwd),
  };
}

/** Remove diagnostic lines absent from the selected structured result. */
function filterCompilerDiagnosticText(
  text: string,
  diagnostics: readonly ITtscCompilerDiagnostic[],
  cwd: string,
): string {
  const out: string[] = [];
  let keepContinuation = true;
  for (const line of text.split(/\r?\n/)) {
    const plain = stripAnsi(line);
    const diagnostic = parseDiagnosticLine(plain, cwd);
    if (diagnostic !== null) {
      keepContinuation = diagnostics.some((selected) =>
        compilerDiagnosticsEqual(selected, diagnostic),
      );
      if (keepContinuation) out.push(line);
      continue;
    }
    if (/^Found\s+\d+\s+errors?/i.test(plain)) continue;
    if (!keepContinuation && /^\s+/.test(line)) continue;
    keepContinuation = true;
    out.push(line);
  }
  return out.join("\n");
}

/** Compare normalized compiler diagnostics before appending fallback output. */
function compilerDiagnosticsEqual(
  left: ITtscCompilerDiagnostic,
  right: ITtscCompilerDiagnostic,
): boolean {
  return (
    left.category === right.category &&
    left.code === right.code &&
    left.file === right.file &&
    diagnosticPositionsEqual(left, right) &&
    diagnosticHeadline(left.messageText) ===
      diagnosticHeadline(right.messageText)
  );
}

/** Compare offsets when available, otherwise compare rendered line/column. */
function diagnosticPositionsEqual(
  left: ITtscCompilerDiagnostic,
  right: ITtscCompilerDiagnostic,
): boolean {
  if (left.start !== undefined && right.start !== undefined) {
    return left.start === right.start;
  }
  return left.line === right.line && left.character === right.character;
}

/** Remove pretty-rendered source context from a diagnostic message. */
function diagnosticHeadline(message: string): string {
  return message.split(/\r?\n/, 1)[0]!.trim();
}

/**
 * Report whether the caller forwarded a print-and-exit tsgo flag
 * (`--showConfig`, `--listFilesOnly`, `--all`, `--init`, `-?`), so ttsc can
 * avoid adding compile-only flags to a command that is not going to compile.
 *
 * Schema-derived, and resolved by flag identity rather than by exact spelling:
 * `resolveFlagSpec` applies the one normalization the parsing engine and the
 * generated Go allow-lists use, so `--showconfig` classifies exactly like
 * `--showConfig`. Adding a new terminal flag means editing `schema.ts` and
 * re-running `pnpm run gen:flags`; this predicate needs no edit, and it grows
 * no normalization of its own for the next consumer to forget.
 */
function forwardsTerminalTsgoFlag(options: TtscCommonOptions): boolean {
  return (
    options.passthrough?.some(
      (token) => resolveFlagSpec(token)?.terminal === true,
    ) ?? false
  );
}

/**
 * Report whether the caller forwarded a terminal flag whose meaning does not
 * presuppose a resolved project (`--init`, `--all`, `-?`).
 *
 * Derived from `FLAG_SCHEMA[*].projectFree`, through the same identity
 * resolution as every other classification — never a literal list of flag names
 * beside this branch, which is the shape that let terminal-flag awareness exist
 * in one layer and be missing from the layer above it.
 */
function forwardsProjectFreeTerminalTsgoFlag(
  options: TtscCommonOptions,
): boolean {
  return (
    options.passthrough?.some((token) => {
      const flag = resolveFlagSpec(token);
      return flag?.terminal === true && flag.projectFree === true;
    }) ?? false
  );
}

/**
 * Report whether the caller forwarded a flag ttsc adds to tsgo internally —
 * e.g. `--listEmittedFiles` (ttsc adds it to learn emitted paths) or `--noEmit`
 * (ttsc adds it for the pre-emit type-check). When the user also forwards the
 * same flag, post-processing must keep the user-visible effect intact instead
 * of stripping it as ttsc-internal noise.
 *
 * Schema-derived: `FLAG_SCHEMA[*].internalShadow === true`. RC-2 from the RCA
 * (RCA section 3, `--listEmittedFiles` / `--showConfig` swallowed): the
 * per-flag `passthrough.includes("…")` check is now one structural lookup
 * against the schema, not one bespoke `if` per shadow flag.
 */
function forwardsInternalShadowFlag(
  options: TtscCommonOptions,
  flag: string,
): boolean {
  const passthrough = options.passthrough;
  if (passthrough === undefined) return false;
  // Resolution covers the bare form (`--pretty`), the inline-value form
  // (`--pretty=true`), and every casing tsgo accepts (`--PRETTY`) — the
  // launcher forwards the user's own spelling verbatim, so comparing raw
  // strings would miss a spelling tsgo honours.
  return passthrough.some((token) => {
    const spec = resolveFlagSpec(token);
    return spec?.internalShadow === true && spec.name === flag;
  });
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
  timing: BuildTiming,
): TtscBuildResult {
  const host = selectSharedHostPlugin(plugins);
  return runNativePluginCommand(
    host,
    createNativeBuildArgs(execution, options, plugins),
    options,
    execution,
    "ttsc.build",
    timing,
    transformHostTimingLabel(plugins),
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
  if (options.quiet === false) {
    result.stdout += verboseBuildSummary(execution, options, emittedFiles);
  }
  return normalizeBuildOutput(
    { ...result, emittedFiles },
    execution.projectRoot,
  );
}

/**
 * The `--verbose` summary for the direct-tsgo lane, in the shape
 * `cmd/ttsc/build.go` already prints on the native-host lane.
 *
 * Verbosity is a launcher-owned presentation concern: which lane `runBuild`
 * selects is an implementation detail the user cannot see, so a documented flag
 * must not change meaning with it. This lane never consumed `quiet` at all,
 * which is why the flag was silent on every project without a ttsc plugin.
 *
 * `sites=0` is a fact about this lane rather than a placeholder: it runs
 * precisely when the project declares no native plugin. A build that emitted
 * nothing prints the header and `emitted=0 files`, so the summary never claims
 * files that were not written.
 */
function verboseBuildSummary(
  execution: ReturnType<typeof resolveExecutionContext>,
  options: RunBuildOptions,
  emittedFiles: readonly string[],
): string {
  const lines = [
    `// ttsc: tsconfig=${execution.tsconfig} cwd=${execution.cwd} sites=0 emit=${options.emit !== false}`,
  ];
  if (options.emit !== false) {
    lines.push(`// ttsc: emitted=${emittedFiles.length} files`);
    for (const file of emittedFiles) {
      lines.push(`  + ${path.relative(execution.cwd, file) || file}`);
    }
  }
  return `${lines.join("\n")}\n`;
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
    // The ttsx runtime build asks for an external map when the project emits
    // none, so its served emit carries a map to inline under the source URL.
    // Pushed before passthrough so an explicit user `--sourceMap` still wins.
    if (options.forceRuntimeSourceMap === true) {
      args.push("--sourceMap", "true");
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
  args.push(...isolatedTsgoOutputArgs(options));
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
 * own diagnostic parser will then see pretty-formatted output and fall back to
 * surfacing it verbatim — the RC-2 contract that `--pretty`'s `internalShadow:
 * true` flag in `FLAG_SCHEMA` declares. Without this guard the order in
 * `runTsgo` (internal flags first, passthrough last) would still let the user's
 * `--pretty true` override at the tsgo level, but ttsc would have already
 * committed to a structured-diagnostics post-process that no longer matches the
 * actual output.
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
  args.push(...createNativeTsgoArgs(options));
  return args;
}

function createNativeProjectInputsArgs(
  execution: ReturnType<typeof resolveExecutionContext>,
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
  if (!hasDiagnosticsFlag(options)) return [];
  return ["--diagnostics"];
}

function nativeHostAcceptsDiagnosticsTiming(
  plugin: ITtscLoadedNativePlugin,
): boolean {
  return plugin.capabilities?.diagnosticsTiming === true;
}

function transformHostTimingLabel(
  plugins: readonly ITtscLoadedNativePlugin[],
): string {
  return (
    `ttsc transform host [` +
    `${plugins.map((plugin) => plugin.name).join(", ")}] time`
  );
}

/**
 * Forward the tsgo flags ttsc did not recognize to a native sidecar as one
 * JSON-encoded `--tsgo-args` flag. The sidecar replays them through tsgo's own
 * option parser onto `CompilerOptions`, so a flag like `ttsc --strict` reaches
 * a plugin build the same way it reaches the plain tsgo lane. Encoded as a
 * single token so the sidecars' unknown-flag filters keep it intact.
 */
function createNativeTsgoArgs(options: TtscCommonOptions): string[] {
  const passthrough = [
    ...(nativeTsgoPassthroughArgs(options) ?? []),
    ...isolatedTsgoOutputArgs(options),
  ];
  if (passthrough.length === 0) {
    return [];
  }
  return ["--tsgo-args=" + JSON.stringify(passthrough)];
}

function isolatedTsgoOutputArgs(options: TtscCommonOptions): string[] {
  const target =
    "isolateOutputsTo" in options &&
    typeof options.isolateOutputsTo === "string"
      ? path.resolve(options.isolateOutputsTo)
      : undefined;
  if (target === undefined) return [];
  return [
    "--outFile",
    "null",
    "--declarationDir",
    "null",
    "--tsBuildInfoFile",
    "null",
    "--outDir",
    target,
  ];
}

function nativeTsgoPassthroughArgs(
  options: TtscCommonOptions,
): readonly string[] | undefined {
  const passthrough = options.passthrough;
  if (passthrough === undefined) return undefined;
  const out: string[] = [];
  for (let i = 0; i < passthrough.length; i++) {
    const token = passthrough[i]!;
    if (isDiagnosticsPassthroughFlag(token)) {
      if (
        !token.includes("=") &&
        i + 1 < passthrough.length &&
        isBooleanLiteral(passthrough[i + 1]!)
      ) {
        i++;
      }
      continue;
    }
    out.push(token);
  }
  return out;
}

function isDiagnosticsPassthroughFlag(token: string): boolean {
  const name = resolveFlagSpec(token)?.name;
  return name === "--diagnostics" || name === "--extendedDiagnostics";
}

function isBooleanLiteral(token: string): boolean {
  const normalized = token.toLowerCase();
  return normalized === "true" || normalized === "false";
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
  timing: BuildTiming,
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
      timing,
      `ttsc check plugin ${plugin.name} time`,
    );
    out = appendBuildOutput(out, result);
    if (result.status !== 0) {
      return out;
    }
  }
  return out;
}

function discoverNativeProjectInputs(
  options: TtscBuildOptions,
  execution: ReturnType<typeof resolveExecutionContext>,
): ITtscProjectInputSnapshot {
  const snapshots: ITtscProjectInputSnapshot[] = [];
  for (const plugin of execution.nativePlugins.filter(
    (candidate) =>
      candidate.stage === "check" &&
      candidate.capabilities?.projectInputs === true,
  )) {
    const res = spawnNative(
      plugin.binary,
      createNativeProjectInputsArgs(execution, plugin),
      {
        cwd: execution.projectRoot,
        env: nativePluginEnv(options.env, execution, plugin),
        encoding: "utf8",
      },
    );
    if (res.error) {
      throw new Error(
        `ttsc.project-inputs: failed to spawn ${plugin.binary}: ${res.error.message}`,
      );
    }
    const stdout = outputText(res.stdout).trim();
    if (res.status !== 0) {
      const detail = outputText(res.stderr).trim() || stdout;
      throw new Error(
        `ttsc.project-inputs: ${plugin.name ?? plugin.binary} failed${detail ? `: ${detail}` : ""}`,
      );
    }
    const snapshot = parseProjectInputSnapshot(stdout, plugin);
    snapshots.push(snapshot);
  }
  return mergeProjectInputSnapshots(execution.projectRoot, snapshots);
}

/**
 * Keep one declared spelling per identity, chosen without regard to order.
 *
 * Two producers can declare the same file under different aliases, and the
 * merged snapshot has to be canonical: last-write-wins would make the published
 * topology depend on which contributor ran first.
 */
function retainDeclaredSpelling(
  target: Map<string, string>,
  key: string,
  declared: string,
): void {
  const previous = target.get(key);
  if (previous === undefined || declared < previous) target.set(key, declared);
}

export function mergeProjectInputSnapshots(
  fallbackRoot: string,
  snapshots: readonly ITtscProjectInputSnapshot[],
  identities: ProjectInputPathIdentityContext = createProjectInputPathIdentityContext(),
): ITtscProjectInputSnapshot {
  const files = new Map<string, string>();
  const globs = new Map<string, string>();
  const reloadDirectories = new Map<string, string>();
  const reloadFiles = new Map<string, string>();
  // Deduplicated on the same identity keys, but holding what the contributors
  // wrote. Normalization resolves a declaration through its symlinks, which is
  // right for every comparison and wrong for the watcher that has to observe
  // the link itself being retargeted.
  const declaredFiles = new Map<string, string>();
  const declaredGlobs = new Map<string, string>();
  const declaredReloadDirectories = new Map<string, string>();
  const declaredReloadFiles = new Map<string, string>();
  const rootIdentity = identities.resolve(fallbackRoot);
  for (const snapshot of snapshots) {
    const candidateRoot = identities.resolve(snapshot.root);
    if (rootIdentity.key !== candidateRoot.key) {
      throw new Error(
        `ttsc.project-inputs: plugin root ${candidateRoot.path} differs from the selected project root ${rootIdentity.path}`,
      );
    }
    for (const file of snapshot.files) {
      const identity = identities.resolve(file);
      files.set(identity.key, identity.path);
      retainDeclaredSpelling(declaredFiles, identity.key, path.resolve(file));
    }
    for (const glob of snapshot.globs) {
      const identity = identities.resolve(glob);
      globs.set(identity.key, identity.path.split(path.sep).join("/"));
      retainDeclaredSpelling(
        declaredGlobs,
        identity.key,
        path.resolve(glob).split(path.sep).join("/"),
      );
    }
    for (const reloadFile of snapshot.reloadFiles ?? []) {
      const identity = identities.resolve(reloadFile);
      reloadFiles.set(identity.key, identity.path);
      retainDeclaredSpelling(
        declaredReloadFiles,
        identity.key,
        path.resolve(reloadFile),
      );
    }
    for (const reloadDirectory of snapshot.reloadDirectories ?? []) {
      const identity = identities.resolve(reloadDirectory);
      reloadDirectories.set(identity.key, identity.path);
      retainDeclaredSpelling(
        declaredReloadDirectories,
        identity.key,
        path.resolve(reloadDirectory),
      );
    }
  }
  return {
    declared: {
      files: [...declaredFiles.values()].sort(),
      globs: [...declaredGlobs.values()].sort(),
      reloadDirectories: [...declaredReloadDirectories.values()].sort(),
      reloadFiles: [...declaredReloadFiles.values()].sort(),
    },
    root: rootIdentity.path,
    files: [...files.values()].sort(),
    globs: [...globs.values()].sort(),
    reloadDirectories: [...reloadDirectories.values()].sort(),
    reloadFiles: [...reloadFiles.values()].sort(),
  };
}

export function parseProjectInputSnapshot(
  text: string,
  plugin: ITtscLoadedNativePlugin,
): ITtscProjectInputSnapshot {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `ttsc.project-inputs: ${plugin.name ?? plugin.binary} returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as { root?: unknown }).root !== "string" ||
    !isStringArray((value as { files?: unknown }).files) ||
    !isStringArray((value as { globs?: unknown }).globs) ||
    ((value as { reloadDirectories?: unknown }).reloadDirectories !==
      undefined &&
      !isStringArray(
        (value as { reloadDirectories?: unknown }).reloadDirectories,
      )) ||
    ((value as { reloadFiles?: unknown }).reloadFiles !== undefined &&
      !isStringArray((value as { reloadFiles?: unknown }).reloadFiles))
  ) {
    throw new Error(
      `ttsc.project-inputs: ${plugin.name ?? plugin.binary} returned an invalid snapshot`,
    );
  }
  const snapshot = value as unknown as ITtscProjectInputSnapshot;
  const invalid = [
    ["root", snapshot.root],
    ...snapshot.files.map((file) => ["file", file] as const),
    ...snapshot.globs.map((glob) => ["glob", glob] as const),
    ...(snapshot.reloadDirectories ?? []).map(
      (directory) => ["reload directory", directory] as const,
    ),
    ...(snapshot.reloadFiles ?? []).map(
      (file) => ["reload file", file] as const,
    ),
  ].find(
    ([, location]) =>
      location.length === 0 || !isAbsoluteLocalProjectInputPath(location),
  );
  if (invalid !== undefined) {
    throw new Error(
      `ttsc.project-inputs: ${plugin.name ?? plugin.binary} returned an invalid snapshot: ${invalid[0]} ${JSON.stringify(invalid[1])} is not an absolute local path`,
    );
  }
  return {
    ...snapshot,
    reloadDirectories: snapshot.reloadDirectories ?? [],
    reloadFiles: snapshot.reloadFiles ?? [],
  };
}

export function isAbsoluteLocalProjectInputPath(
  location: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (location.includes("\0")) return false;
  if (platform !== "win32") return path.posix.isAbsolute(location);
  const normalized = location.replaceAll("/", "\\");
  if (/^[A-Za-z]:\\/.test(normalized)) return true;
  if (normalized.startsWith("\\\\?\\")) {
    const extended = normalized.slice(4);
    if (/^[A-Za-z]:\\/.test(extended)) return true;
    if (extended.toLowerCase().startsWith("unc\\")) {
      return isWindowsUncProjectInputPath(`\\\\${extended.slice(4)}`);
    }
    return false;
  }
  if (normalized.startsWith("\\\\.\\")) return false;
  return isWindowsUncProjectInputPath(normalized);
}

function isWindowsUncProjectInputPath(location: string): boolean {
  const matched = /^\\\\([^\\]+)\\([^\\]+)(?:\\|$)/.exec(location);
  return (
    matched !== null &&
    isWindowsUncVolumeSegment(matched[1]!) &&
    isWindowsUncVolumeSegment(matched[2]!)
  );
}

function isWindowsUncVolumeSegment(segment: string): boolean {
  return segment !== "." && segment !== ".." && !/[\0<>:"/\\|?*]/.test(segment);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
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
  timing: BuildTiming,
  timingLabel: string,
): TtscBuildResult {
  const startedAt = process.hrtime.bigint();
  const res = spawnNative(plugin.binary, args, {
    cwd: execution.projectRoot,
    env: nativePluginEnv(options.env, execution, plugin),
    encoding: "utf8",
  });
  recordTiming(timing, timingLabel, startedAt);
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
 * Synthesize one structured diagnostic from a non-zero process result that
 * produced no parsable diagnostics, carrying the captured stderr/stdout as the
 * message. Shared by the public API result mapping and the plugin-failure
 * recovery pass so the failure text is never dropped from structured output.
 */
export function createProcessDiagnostic(
  result: TtscBuildResult,
): ITtscCompilerDiagnostic {
  const messageText =
    (result.stderr || result.stdout).trim() ||
    `ttsc exited with status ${result.status}`;
  return {
    category: "error",
    code: "TTSC_PROCESS",
    file: null,
    messageText,
  };
}

/**
 * Resolve all runtime context needed for a build: cwd, tsconfig path, project
 * root, tsgo binary location, and the loaded native plugin list. Centralised
 * here so every code path in `runBuild` shares the same resolution logic.
 */
function resolveExecutionContext(
  options: TtscCommonOptions & {
    emit?: boolean;
    onWatchInputs?: (inputs: readonly string[]) => void;
    resolvedProject?: ITtscParsedProjectConfig;
    tsconfig?: string;
  },
) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const project =
    options.resolvedProject ??
    readProjectConfig({
      cwd,
      projectRoot: options.projectRoot,
      tsconfig: options.tsconfig,
    });
  const tsconfig = project.path;
  const projectRoot = project.root;
  const tsgo = resolveTsgo({ ...options, cwd: projectRoot });
  let pluginSetupFailure: TtscBuildResult | undefined;
  let nativePlugins: ITtscLoadedNativePlugin[] = [];
  try {
    if (hasProjectPluginEntries(project, options.plugins)) {
      nativePlugins = loadProjectPlugins({
        binary: resolveBinary(options) ?? "",
        cacheDir: options.cacheDir ?? options.env?.TTSC_CACHE_DIR,
        cwd,
        entries: options.plugins,
        env: { ...process.env, ...options.env },
        onWatchInputs: options.onWatchInputs,
        pluginConfigDir: options.pluginConfigDir,
        projectRoot,
        tsconfig,
      }).nativePlugins;
    } else {
      options.onWatchInputs?.([]);
    }
  } catch (error) {
    pluginSetupFailure = {
      diagnostics: [],
      status: 2,
      stdout: "",
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
  return {
    cwd,
    nativePlugins,
    pluginConfigDir: resolvePluginConfigDir({
      cwd,
      pluginConfigDir: options.pluginConfigDir,
    }),
    pluginSetupFailure,
    project,
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
