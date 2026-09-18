import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";

/**
 * Report whether the live notifications can still prove membership. A watcher
 * that failed to register, or that errored after the generation was produced,
 * proves nothing either way — it never proves the generation stale. Neither
 * does one whose events may have been dropped since the state was last proven
 * (samchon/ttsc#1418), until a delivery proves it again.
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
