import type { TtscCachedProjectTransform } from "./TtscCachedProjectTransform";

/**
 * Close a generation's retained watchers and stop it relying on them.
 *
 * Validation lets a retained watcher's silence stand in for re-reading inputs.
 * When the host's watch policy stops justifying that, the watchers are closed
 * and detached, and every later validation of the generation takes the path a
 * generation whose watchers never opened already takes: its recorded snapshot.
 * The clock reference and the generation itself stay, so an unchanged project
 * keeps its compile.
 *
 * @evidence contracts/common.md#principled-implementation Detaching all tracker fields before closure removes their authority immediately, so subsequent validation cannot rely on a tracker whose cleanup failed.
 * @evidence contracts/common.md#clear-and-simple-design Withdrawal closes notification resources while preserving the generation and clock evidence needed by recorded-state validation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Close failures cannot create freshness proof; every independent tracker is still attempted and retained output remains subject to snapshot validation.
 * @evidence contracts/common.md#meaningful-documentation The prose explains the authority transition, and the internal comment distinguishes cleanup failure from stale-output authorization.
 * @evidence contracts/performance.md#efficient-algorithms Withdrawal examines only three trackers rather than discarding or recompiling the whole project.
 * @evidence contracts/performance.md#reuse-equivalent-work Generation and clock evidence remain reusable under snapshot validation, so changed watch policy alone does not waste an equivalent compile.
 * @evidence contracts/performance.md#bound-retention-and-release-resources All tracker fields are detached before closing and every independent close attempt runs; repeat withdrawal sees no retained handle.
 */
export function withdrawGenerationNotifications(
  cached: TtscCachedProjectTransform,
): void {
  const trackers = [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
    cached.candidateMutationTracker,
  ];
  if (trackers.every((tracker) => tracker === undefined)) return;
  cached.projectMutationTracker = undefined;
  cached.hostInputMutationTracker = undefined;
  cached.candidateMutationTracker = undefined;
  for (const tracker of trackers) {
    try {
      tracker?.close();
    } catch {
      // The generation no longer reads the tracker, so a close failure leaves
      // nothing it could serve stale.
    }
  }
}
