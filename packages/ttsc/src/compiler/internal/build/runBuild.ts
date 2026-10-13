import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { BuildExecution } from "./BuildExecution";
import { BuildTiming } from "./BuildTiming";
import type { RunBuildOptions } from "./RunBuildOptions";
import { WatchInputPublication } from "./WatchInputPublication";

/**
 * Run `ttsc` against a tsconfig. Returns once the binary exits so the CLI can
 * decide how to surface diagnostics. Non-zero process exit is returned as a
 * result; configuration resolution and process-launch failures may throw.
 *
 * Project-free terminal flags bypass project/plugin setup when applicable.
 * Required emit provenance preserves compiler selection and exposes unknown
 * ownership when the selected producer cannot establish the requested relation.
 * Watch-input handlers must complete synchronously; use {@link runBuild.async}
 * when a handler returns a promise.
 *
 * @evidence contracts/common.md#principled-implementation Shared preparation selects project and plugins before execution, while project-free terminal requests take their supported direct compiler path; timing is appended after the resulting build phase.
 * @evidence contracts/common.md#clear-and-simple-design The public synchronous entry owns timing and delegates setup/execution to BuildExecution, keeping the same build policy available to watch sessions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Terminal bypass follows compiler flag semantics and plugin failures remain visible; no retry hides configuration or spawn errors.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes returned exit failures from thrown setup/launch errors and explains the project-free branch.
 * @evidence contracts/portability.md#os-neutral-implementation Execution selection and spawning use the shared native path/process boundaries with cwd and separate argv, rather than constructing a shell command here.
 * @evidence contracts/performance.md#efficient-algorithms Timing creation and terminal selection make their own flag projections before the selected preparation/execution path. Delegated configuration, plugin, native/provenance and diagnostic work follows its actual input/report sizes; timing formatting scans ledger labels and output. No measured dominance or duration/output ceiling is established by this wrapper.
 * @evidence contracts/performance.md#reuse-equivalent-work A resolved execution context is carried through preparation and execution, so this build does not reload its plugin selection between phases.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The ledger and execution state are build-owned, while returned output/proof/diagnostic records transfer to the caller; no resident handle or historical build is stored here. Delegated native/probe/artifact acquisition and cleanup may be best effort, and thrown setup can precede some cleanup boundaries. This wrapper supplies no duration/output bound or descendant-release certification.
 */
export function runBuild(options: RunBuildOptions = {}): TtscBuildResult {
  return WatchInputPublication.run(runBuild.steps(options));
}

/**
 * Share one build sequence between synchronous APIs and awaited watch cycles.
 *
 * @evidence contracts/common.md#principled-implementation Both completion modes use the same timed terminal selection, context acquisition, preparation and compile sequence. The asynchronous runner joins every plugin and project publication before native compilation; composing callers must deliver callback rejection into that sequence.
 * @evidence contracts/common.md#clear-and-simple-design The namespace keeps awaited completion beside its synchronous entry and exposes one timing and phase sequence to single-file orchestration; BuildExecution retains build policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Awaiting changes only publication completion, preserves compiler/plugin selection and project-free terminal behavior, and sends publication failure through existing setup and cleanup rather than bypassing a pending baseline.
 * @evidence contracts/common.md#meaningful-documentation Entry prose states the publication barrier, order before compilation and internal callers' obligation to complete the sequence and deliver rejection.
 * @evidence contracts/portability.md#os-neutral-implementation BuildExecution retains native cwd, path identity and argument-array ownership across suspension; the namespace adds no independent native boundary.
 * @evidence contracts/performance.md#efficient-algorithms Each selected terminal, context, discovery, preparation and compile phase runs once; each publication adds one await and constant sequence state.
 * @evidence contracts/performance.md#reuse-equivalent-work One resolved execution context serves preparation and compilation without reloading plugins; the namespace retains no completed build or in-flight cache.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The invocation owns its sequence, ledger, context and current handoff while callbacks settle. Selected results transfer to the caller, delegated resource ownership and cleanup stay unchanged, and no resident history is retained.
 */
export namespace runBuild {
  /**
   * Run a build after each watch-input handler's returned promise settles.
   * Compilation starts only after both plugin and project baselines complete.
   */
  export function async(
    options: RunBuildOptions = {},
  ): Promise<TtscBuildResult> {
    return WatchInputPublication.runAsync(steps(options));
  }

  /**
   * Produce one timed build, yielding watch handoffs before native work.
   * Composing owners must complete the sequence and deliver callback rejection
   * back into it so the existing setup and cleanup policies apply.
   */
  export function* steps(
    options: RunBuildOptions,
  ): WatchInputPublication.Sequence<TtscBuildResult> {
    const timing = BuildTiming.createBuildTiming(options);
    const projectFree = BuildExecution.runProjectFreeTerminalFlag(options);
    if (projectFree !== null)
      return BuildTiming.appendTimingOutput(projectFree, timing);
    const setupStartedAt = process.hrtime.bigint();
    const execution =
      yield* BuildExecution.resolveExecutionContextSteps(options);
    const prepared = yield* BuildExecution.prepareBuildExecutionSteps(
      options,
      timing,
      execution,
      setupStartedAt,
    );
    const result =
      prepared.result ??
      BuildExecution.runPreparedBuild(
        options,
        timing,
        execution,
        prepared.buildOptions,
      );
    return BuildTiming.appendTimingOutput(result, timing);
  }
}
