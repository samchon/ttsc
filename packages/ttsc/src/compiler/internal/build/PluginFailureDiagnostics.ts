import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { PassthroughFlags } from "./PassthroughFlags";
import type { RunBuildOptions } from "./RunBuildOptions";
import { appendBuildOutput } from "./appendBuildOutput";
import { createProcessDiagnostic } from "./createProcessDiagnostic";

/**
 * Select and merge the independent diagnostic recovery after a plugin failure.
 * The build engine still owns the native check and report filtering. These
 * supplied results do not establish how either producer acquired its output.
 *
 * @evidence contracts/common.md#principled-implementation Mode exclusions and original failure ownership remain distinct from native execution and report deduplication.
 * @evidence contracts/common.md#clear-and-simple-design One concern groups the recovery gate and final merge used by the actual build engine.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The namespace supplies no executor or synthetic producer and never turns recovery into a successful plugin build.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes policy inputs from producer execution and acquisition.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This grouping performs no native path, filesystem or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Members own policy composition; the namespace selects no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This namespace owns no computed-result cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This grouping holds no runtime registry, handle or task.
 */
export namespace PluginFailureDiagnostics {
  /**
   * Permit the independent check unless the selected mode omits diagnostics.
   * Failure admission belongs to the caller; this gate neither changes status
   * nor classifies a successful producer as failed.
   *
   * @evidence contracts/common.md#principled-implementation Exact true format/skip controls and the existing forwarded terminal selector preserve the build engine's recovery exclusions.
   * @evidence contracts/common.md#clear-and-simple-design One predicate owns the mode gate while the caller retains execution and exception ordering.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied options use the real terminal flag policy, without a fake compiler or test-only execution callback.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the caller's failure premise and this predicate's diagnostic-mode responsibility.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Supplied option values and forwarded argument semantics are inspected without native paths, filesystem or process calls.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This gate composes scalar checks and the existing terminal selector; argument interpretation belongs to that selector.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current supplied options are evaluated directly, without caching or cross-call reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This predicate retains no option population, handle or task.
   */
  export function shouldCollect(options: RunBuildOptions): boolean {
    return !(
      options.format === true ||
      options.skipDiagnosticsCheck === true ||
      PassthroughFlags.forwardsTerminalTsgoFlag(options)
    );
  }

  /**
   * Keep the original failure when no new diagnostic batch remains. Otherwise
   * seed its unparsed process failure before the recovered reports and retain
   * its status, even if the independent check returned another status.
   *
   * @evidence contracts/common.md#principled-implementation A null filtered batch preserves failure identity; an empty original diagnostic list receives the shared process diagnostic before phase merging, and the original status replaces the merged status.
   * @evidence contracts/common.md#clear-and-simple-design Seeding, delegated output merge and status restoration form one result adaptation, separate from native execution and filtering.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Reports come from supplied producer results; process seeding exposes the original failure rather than inventing a successful compiler response.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes null-batch identity from seeded merging and states status ownership.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Supplied result records and text are composed without resolving paths or invoking native filesystem/process APIs.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This adapter delegates record/text/witness merging to appendBuildOutput and message selection to createProcessDiagnostic, without another traversal strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The already filtered batch is consumed once; this adapter owns no producer capture or cross-request cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Constructed result records transfer to the caller; this adapter retains no historical population, native handle or task.
   */
  export function append(
    failure: TtscBuildResult,
    fallback: TtscBuildResult | null,
  ): TtscBuildResult {
    if (fallback === null) return failure;
    const seeded =
      failure.diagnostics.length === 0
        ? { ...failure, diagnostics: [createProcessDiagnostic(failure)] }
        : failure;
    const status = failure.status;
    return { ...appendBuildOutput(seeded, fallback), status };
  }
}
