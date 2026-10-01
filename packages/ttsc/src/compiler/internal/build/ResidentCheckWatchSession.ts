import fs from "node:fs";

import { touchPluginCacheEntryInUse } from "../../../plugin/internal/source/touchPluginCacheEntryInUse";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { ResidentCheckProcess } from "../ResidentCheckProcess";
import { type ResidentCheckRequest } from "../ResidentCheckRequest";
import { BuildExecution } from "./BuildExecution";
import { BuildTiming } from "./BuildTiming";
import { NativePluginArguments } from "./NativePluginArguments";
import { PassthroughFlags } from "./PassthroughFlags";
import type { ResidentCheckWatchChange } from "./ResidentCheckWatchChange";
import type { RunBuildOptions } from "./RunBuildOptions";
import { TsgoArguments } from "./TsgoArguments";
import { appendBuildOutput } from "./appendBuildOutput";
import { bufferResidentCheckEntryRequests } from "./bufferResidentCheckEntryRequests";
import { normalizeBuildOutput } from "./normalizeBuildOutput";
import { planResidentCheckEntries } from "./planResidentCheckEntries";
import { residentCheckRequest } from "./residentCheckRequest";
import { takeResidentCheckEntryRequest } from "./takeResidentCheckEntryRequest";

/**
 * Analysis-only watch coordinator.
 *
 * The selected project and compatible check-stage processes stay resident
 * across ordinary source/data edits. A config, root-set, contributor, or plugin
 * topology transition calls for a full reset before the next cycle. Emit and
 * transform lanes can pass through the coordinator, but compatibility checks
 * keep them on the established one-shot path without starting sidecars.
 *
 * The watch launcher must serialize cycles and use reload when invocation
 * selection or startup environment changes. A session does not independently
 * compare every option/environment field before reusing its cached context.
 * `TTSC_WATCH_DEBUG_INPUTS` reports why selection is reset and how many
 * sidecars it releases, and distinguishes a failed resident transport.
 *
 * @evidence contracts/common.md#principled-implementation Stable invocation selection and serialized cycles let compatible analysis-only checks retain their Program; explicit reload and observed input-topology changes reset selection before another cycle.
 * @evidence contracts/common.md#clear-and-simple-design The session owns selected execution, dependency snapshot, process identities and per-entry delivery buffers while shared BuildExecution owns one-shot phase and failure policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Capability-aware residency has an actual transport-failure one-shot path, not a successful-result substitution; configuration positions remain distinct even when processes share a key.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state supported lanes, reset causes and the caller's serialization/stable-invocation premise; run and dispose document lifecycle effects.
 * @evidence contracts/portability.md#os-neutral-implementation Native filesystem checks and cache touch helpers use selected binary paths; child creation delegates native executable/argv/environment handling to ResidentCheckProcess and BuildExecution.
 * @evidence contracts/performance.md#efficient-algorithms Per-cycle selection and buffer union scale with configured checks and pending paths; snapshot comparisons are linear in normalized inputs and accumulated output may recopy earlier phase text.
 * @evidence contracts/performance.md#reuse-equivalent-work Process keys include binary/name/argv/compiler payload, while stable invocation context and reload guard the remaining startup inputs; current input snapshots and change requests determine warm Program updates.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Reset/dispose clear execution, snapshots, buffers and sidecar ownership; under stable options process keys are bounded by configured checks, but pending unique paths may grow during repeated earlier failures and OS-level termination is delegated to the child owner.
 */
export class ResidentCheckWatchSession {
  private execution:
    | ReturnType<typeof BuildExecution.resolveExecutionContext>
    | undefined;

  /** Undelivered changes keyed by configured check position, not process key. */
  private readonly pendingChanges = new Map<number, ResidentCheckRequest>();

  /** Latest normalized dependency population, plus declared watch aliases. */
  private projectInputs: ITtscProjectInputSnapshot | undefined;

  /** Sidecars acquired for the stable invocation; reset releases every key. */
  private readonly processes = new Map<string, ResidentCheckProcess>();

  /**
   * Run one serialized watch cycle through the shared build/check policies.
   * Options identifying the invocation and startup environment must remain
   * stable until reload; callers must not run overlapping cycles.
   *
   * The first cycle, and any cycle after `change.reload`, resolves the project
   * and plugins and starts resident check processes for compatible entries.
   * Later cycles reuse them and forward `change` as an incremental request. A
   * resident process that fails is retired and its entry falls back to the
   * one-shot check for that cycle.
   *
   * @evidence contracts/common.md#principled-implementation Compatible no-emit check-only selection uses the same diagnostic/failure policy as one-shot execution; reload, missing binaries and changed normalized dependency topology cold-resolve the next execution.
   * @evidence contracts/common.md#clear-and-simple-design The cycle separates setup/reuse, topology refresh, ordered checks and final diagnostics/timing, delegating each phase to its owning shared operation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed resident transport retires that process and uses the established real check command; the fallback neither drops forwarded compiler options nor converts a nonzero check into success.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs document serialization, stable startup inputs, reload and failed-sidecar behavior instead of claiming arbitrary option changes are handled automatically.
   * @evidence contracts/portability.md#os-neutral-implementation Native binary existence and cache freshness use filesystem helpers; all commands preserve selected cwd and use native process/environment abstractions without shell interpolation.
   * @evidence contracts/performance.md#efficient-algorithms Warm cycles avoid project/plugin re-resolution, but still perform required dependency discovery and per-entry change union; total cost includes actual host work and pending-path sorting.
   * @evidence contracts/performance.md#reuse-equivalent-work Selected context and capability-supported sidecars survive only stable invocation cycles; change requests update Programs, reload/topology transitions reset them, and effectful configured entries remain separately scheduled.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The session retains successful sidecars and per-entry pending changes; failures retire their process, reset clears all state, and unconsumed path sets have no finite bound while an earlier entry repeatedly fails.
   */
  public async run(
    options: RunBuildOptions,
    change: ResidentCheckWatchChange = {},
  ): Promise<TtscBuildResult> {
    if (change.reload === true) this.reset("watch-reload");

    const timing = BuildTiming.createBuildTiming(options);
    const projectFree = BuildExecution.runProjectFreeTerminalFlag(options);
    if (projectFree !== null) {
      this.reset("terminal-flag");
      return BuildTiming.appendTimingOutput(projectFree, timing);
    }

    let execution = this.execution;
    const reusedExecution = execution !== undefined;
    let buildOptions: RunBuildOptions;
    if (execution === undefined) {
      const setupStartedAt = process.hrtime.bigint();
      execution = BuildExecution.resolveExecutionContext(options);
      const discoveryOptions = this.captureProjectInputs(options);
      const prepared = BuildExecution.prepareBuildExecution(
        discoveryOptions,
        timing,
        execution,
        setupStartedAt,
      );
      buildOptions = prepared.buildOptions;
      if (prepared.result !== undefined) {
        this.reset("preparation-result");
        return BuildTiming.appendTimingOutput(prepared.result, timing);
      }
      if (!residentCheckExecutionIsCompatible(buildOptions, execution)) {
        this.reset("incompatible-execution");
        return BuildTiming.appendTimingOutput(
          BuildExecution.runPreparedBuild(
            options,
            timing,
            execution,
            buildOptions,
          ),
          timing,
        );
      }
      this.execution = execution;
    } else {
      // The session keeps running the plugin binaries it resolved without
      // resolving them again, so it records each cycle's use in their cache
      // entries, and a binary the cache removed anyway sends the session back
      // through resolution, which builds it again, rather than failing a
      // sidecar respawn (samchon/ttsc#1556).
      if (
        execution.nativePlugins.some((plugin) => !fs.existsSync(plugin.binary))
      ) {
        this.reset("missing-plugin-binary");
        return this.run(options);
      }
      for (const plugin of execution.nativePlugins)
        touchPluginCacheEntryInUse(plugin.binary);
      buildOptions = BuildExecution.applyProjectNoEmit(options, execution);
    }
    if (
      reusedExecution &&
      this.refreshProjectInputTopology(options, execution)
    ) {
      this.reset("project-input-topology");
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
      result = BuildExecution.appendTypeScriptDiagnosticsAfterPluginFailure(
        checked,
        buildOptions,
        execution,
      );
    } else if (
      BuildExecution.checkPluginsReportTypeScriptDiagnostics(
        execution.nativePlugins,
      )
    ) {
      result = checked;
    } else {
      result = appendBuildOutput(
        checked,
        BuildExecution.runTsgo(execution, ["--noEmit"], buildOptions),
      );
    }
    return BuildTiming.appendTimingOutput(result, timing);
  }

  /**
   * Request termination of every retained sidecar and discard session state.
   * This is synchronous release initiation, not an awaitable guarantee of OS
   * process exit; child termination and queued-request rejection belong to the
   * ResidentCheckProcess owner. A later run can start a fresh session
   * selection.
   *
   * @evidence contracts/common.md#principled-implementation Reset visits each owned process before clearing its map and discards pending changes, dependency snapshot and selected execution together.
   * @evidence contracts/common.md#clear-and-simple-design Disposal uses the same reset boundary as topology transitions, keeping resource and cached-selection release in one place.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Release calls the supported child disposal API rather than replacing process methods or marking still-owned resources as successful check results.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes termination initiation from awaited OS exit and describes fresh reuse after disposal.
   * @evidence contracts/portability.md#os-neutral-implementation Platform-specific child termination is delegated to ResidentCheckProcess; this coordinator does not assume a POSIX signal guarantees process-tree exit on every OS.
   * @evidence contracts/performance.md#efficient-algorithms Reset traverses the retained process population once and clears maps without scanning individual pending paths.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Disposal invalidates shared execution ownership rather than establishing reusable computation.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources Every retained process receives dispose before map ownership is cleared, and buffer/snapshot/context references are released; actual native termination guarantees remain with the child owner.
   */
  public dispose(): void {
    this.reset("dispose");
  }

  /** Release the selected invocation and every sidecar/buffer acquired for it. */
  private reset(reason: string): void {
    if (process.env.TTSC_WATCH_DEBUG_INPUTS) {
      process.stdout.write(
        `[ttsc:debug] resident reset ${JSON.stringify({
          reason,
          selectedExecution: this.execution !== undefined,
          processes: this.processes.size,
        })}\n`,
      );
    }
    for (const process of this.processes.values()) process.dispose();
    this.processes.clear();
    this.pendingChanges.clear();
    this.execution = undefined;
    this.projectInputs = undefined;
  }

  /** Capture discoveries only when the caller actually subscribes to them. */
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

  /**
   * Refresh normalized Program topology while always publishing declared alias
   * updates to the watcher, even when physical dependency identity is
   * unchanged.
   */
  private refreshProjectInputTopology(
    options: RunBuildOptions,
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
  ): boolean {
    if (options.onProjectInputs === undefined) return false;
    const next = BuildExecution.discoverNativeProjectInputs(options, execution);
    const changed =
      this.projectInputs !== undefined &&
      !projectInputSnapshotsEqual(this.projectInputs, next);
    this.projectInputs = next;
    options.onProjectInputs(next);
    return changed;
  }

  /**
   * Deliver changes in configured order, retaining later entries' undelivered
   * requests after an earlier failure. Process sharing never shares away a
   * configured check invocation.
   */
  private async runCheckPlugins(
    options: RunBuildOptions,
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
    timing: BuildTiming.BuildTiming,
    change: ResidentCheckWatchChange,
  ): Promise<TtscBuildResult> {
    let out: TtscBuildResult = {
      diagnostics: [],
      status: 0,
      stderr: "",
      stdout: "",
    };
    const tsgoArgs = TsgoArguments.createNativeTsgoArgs(options);
    const checks = planResidentCheckEntries(
      execution.nativePlugins,
      (plugin) =>
        NativePluginArguments.createNativeCheckArgs(execution, options, plugin),
      tsgoArgs,
    );
    const request = residentCheckRequest(change, execution.projectRoot);
    // Buffer the cycle for every resident plugin before running any of them.
    // An earlier plugin may fail and short-circuit diagnostics, but a later
    // sidecar must still receive every filesystem transition when it resumes.
    bufferResidentCheckEntryRequests(this.pendingChanges, checks, request);

    for (const { args, entryIndex, key, plugin } of checks) {
      let result: TtscBuildResult;
      if (key === undefined) {
        result = BuildExecution.runNativePluginCommand(
          plugin,
          args,
          options,
          execution,
          "ttsc.check",
          timing,
          `ttsc check plugin ${plugin.name} time`,
          tsgoArgs,
        );
      } else {
        const startedAt = process.hrtime.bigint();
        let resident = this.processes.get(key);
        if (resident === undefined) {
          resident = new ResidentCheckProcess({
            args: ["check-serve", ...args.slice(1)],
            binary: plugin.binary,
            cwd: execution.projectRoot,
            env: BuildExecution.nativePluginEnv(
              options.env,
              execution,
              plugin,
              tsgoArgs,
            ),
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
          if (process.env.TTSC_WATCH_DEBUG_INPUTS) {
            process.stdout.write(
              `[ttsc:debug] resident transport failed ${JSON.stringify({
                entryIndex,
                plugin: plugin.name,
              })}\n`,
            );
          }
          resident.dispose();
          this.processes.delete(key);
          // The one-shot fallback observes the complete current filesystem,
          // and a later sidecar starts cold, so neither needs old deltas.
          // A capability-aware host may still disappear or violate framing.
          // Preserve correctness by running the established one-shot command
          // for this cycle; the next cycle gets one clean respawn attempt. It
          // carries the same forwarded compiler flags the resident host was
          // started with: a failed transport is not a request to drop them.
          result = BuildExecution.runNativePluginCommand(
            plugin,
            args,
            options,
            execution,
            "ttsc.check",
            { ...timing, enabled: false },
            "",
            tsgoArgs,
          );
        }
        BuildTiming.recordTiming(
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

/**
 * Compare canonical physical topology; alias watch spellings refresh
 * separately.
 */
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

/**
 * Residency serves analysis-only check stages without fix/format/terminal
 * effects.
 */
function residentCheckExecutionIsCompatible(
  options: RunBuildOptions,
  execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
): boolean {
  return (
    options.emit === false &&
    options.fix !== true &&
    options.format !== true &&
    PassthroughFlags.forwardsTerminalTsgoFlag(options) === false &&
    execution.nativePlugins.every((plugin) => plugin.stage === "check")
  );
}
