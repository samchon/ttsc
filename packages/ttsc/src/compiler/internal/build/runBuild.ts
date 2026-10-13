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
 * @evidence contracts/common.md#principled-implementation Completion modes use the same terminal selection, context acquisition, preparation and compile sequence.
 * @evidence contracts/common.md#clear-and-simple-design The namespace keeps the companion beside its synchronous entry and exposes the sequence to single-file orchestration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Awaiting changes only publication completion and preserves compiler/plugin selection and failure results.
 * @evidence contracts/common.md#meaningful-documentation The entries state the publication barrier and internal sequence consumption contract.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The grouping introduces no native boundary beyond the selected build operations.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The grouping chooses no algorithm beyond its build sequence and completion runner.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The grouping retains no build cache or in-flight operation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Each invocation owns its sequence and selected build resources.
 */
export namespace runBuild {
  /**
   * Run a build after each watch-input handler's returned promise settles.
   * Compilation starts only after both plugin and project baselines complete.
   *
   * @evidence contracts/common.md#principled-implementation The asynchronous runner joins every handoff in the shared build sequence before native compilation proceeds.
   * @evidence contracts/common.md#clear-and-simple-design The companion delegates all build policy to the same sequence as the synchronous entry.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A pending publication cannot be reported as completed registration or bypassed by a fallback build.
   * @evidence contracts/common.md#meaningful-documentation Native prose states awaited handler completion and ordering before compilation.
   * @evidence contracts/portability.md#os-neutral-implementation BuildExecution retains native cwd, path and argument-array ownership across suspension.
   * @evidence contracts/performance.md#efficient-algorithms The runner adds one await per handoff while the existing context, discovery and build phases run once.
   * @evidence contracts/performance.md#reuse-equivalent-work One resolved execution context serves preparation and compilation without a second plugin load.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One invocation sequence remains live during callback completion; its selected results transfer to the caller and no resident history is retained here.
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
   *
   * @evidence contracts/common.md#principled-implementation Shared context and preparation sequences suspend at actual producer boundaries before the existing compile dispatcher runs.
   * @evidence contracts/common.md#clear-and-simple-design One sequence owns timing and phase order for synchronous, asynchronous and single-file calls.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Project-free terminal requests preserve their direct path and publication failures retain their existing failure handling.
   * @evidence contracts/common.md#meaningful-documentation Native prose documents sequence completion, rejection delivery and ordered native work.
   * @evidence contracts/portability.md#os-neutral-implementation All native execution and identity decisions remain in the existing BuildExecution operations.
   * @evidence contracts/performance.md#efficient-algorithms Each selected setup, discovery and compile phase runs once; yielded handoffs require constant additional sequence state.
   * @evidence contracts/performance.md#reuse-equivalent-work The selected context is reused through preparation and compilation within the invocation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The ledger, context and current handoff live only for this build; delegated resource and output ownership remain unchanged.
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
