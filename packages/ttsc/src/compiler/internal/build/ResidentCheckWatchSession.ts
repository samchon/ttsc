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
 */
export class ResidentCheckWatchSession {
  private execution:
    | ReturnType<typeof BuildExecution.resolveExecutionContext>
    | undefined;
  private readonly pendingChanges = new Map<number, ResidentCheckRequest>();
  private projectInputs: ITtscProjectInputSnapshot | undefined;
  private readonly processes = new Map<string, ResidentCheckProcess>();

  /**
   * Run one watch cycle and return its result, exactly as a one-shot
   * {@link runBuild} with the same options would report it.
   *
   * The first cycle, and any cycle after `change.reload`, resolves the project
   * and plugins and starts resident check processes for compatible entries.
   * Later cycles reuse them and forward `change` as an incremental request. A
   * resident process that fails is retired and its entry falls back to the
   * one-shot check for that cycle.
   */
  public async run(
    options: RunBuildOptions,
    change: ResidentCheckWatchChange = {},
  ): Promise<TtscBuildResult> {
    if (change.reload === true) this.reset();

    const timing = BuildTiming.createBuildTiming(options);
    const projectFree = BuildExecution.runProjectFreeTerminalFlag(options);
    if (projectFree !== null) {
      this.reset();
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
        this.reset();
        return BuildTiming.appendTimingOutput(prepared.result, timing);
      }
      if (!residentCheckExecutionIsCompatible(buildOptions, execution)) {
        this.reset();
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
      buildOptions = BuildExecution.applyProjectNoEmit(options, execution);
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
