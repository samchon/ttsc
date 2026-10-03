import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";

/**
 * Report whether the live notifications can still prove membership. A watcher
 * that failed to register, or that errored after the generation was produced,
 * proves nothing either way — it never proves the generation stale. Neither
 * does one whose events may have been dropped since the state was last proven
 * (samchon/ttsc#1425), until a delivery proves it again.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Mandatory project and host coverage must both be live and verified;
 *   absent candidate coverage is allowed because candidate reads remain.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A two-element mandatory check and one optional check express the different
 *   authorities without merging absence with failure.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Failure withdraws notification proof; it never invents a stale-generation
 *   verdict or bypasses the remaining per-delivery observations.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose distinguishes proof loss from positive mutation evidence;
 *   the candidate comment explains optionality under the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A few constant-time field reads.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Re-evaluated per delivery because a tracker can fail or lose events at any moment.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Reads tracker state flags; it reads no filesystem and parses no path.
 */
export function notificationsProveMembership(
  cached: TtscCachedProjectTransform,
): boolean {
  for (const tracker of [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
  ]) {
    if (
      tracker === undefined ||
      tracker.failed ||
      tracker.unverified === true
    ) {
      return false;
    }
  }
  // The candidate tracker is optional: a generation with no absent candidate
  // opens none, and one that declined to watch them left the per-delivery probe
  // in place. Only a tracker that exists and has failed, or may have dropped
  // events, withdraws the proof.
  const candidates = cached.candidateMutationTracker;
  return candidates?.failed !== true && candidates?.unverified !== true;
}
