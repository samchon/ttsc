import type { TtscProjectMutationTracker } from "./TtscProjectMutationTracker";

/**
 * Yield to the loop the tracker's own watcher callbacks are queued on.
 *
 * Two turns for the same reason the broker takes two: the first gives the loop
 * a poll phase for completions the kernel had already queued, the second runs
 * after the callbacks they produced.
 */
function drainOnNextTurn(): Promise<boolean> {
  return new Promise<boolean>((resolve) =>
    setImmediate(() => setImmediate(() => resolve(true))),
  );
}

/**
 * Settle one set of optional trackers through one shared barrier each.
 *
 * A tracker whose barrier did not hold is marked unverified, so its silence
 * proves nothing until a delivery proves the recorded state by reading it
 * (samchon/ttsc#1428).
 *
 * @evidence contracts/common.md#principled-implementation
 *   Each tracker uses its own channel; failed drainage marks its coverage
 *   unverified rather than manufacturing a mutation or valid silence.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Optional inputs are filtered once and each tracker owns one settle promise;
 *   no global barrier conflates distinct notification channels.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The supported drain is used when present; failure withdraws proof instead
 *   of retrying through an unrelated backend or suppressing invalidation.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain shared barriers and what failed drainage means,
 *   following the documentation skill.
 * @evidence contracts/performance.md#efficient-algorithms
 *   For n candidates, filtering and scheduling are O(n) with O(n) temporary
 *   promises; independent channels drain concurrently.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Concurrent deliveries share tracker.settle only while the same channel's
 *   barrier is in flight; finally clears it so later events require a new drain.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Each tracker retains at most one settle promise and releases that reference
 *   on either resolution or rejection; backend drains own native request cleanup.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Awaits tracker drains; the backend-specific ordering belongs to each tracker's own drain.
 */
export async function settleMutationTrackers(
  candidates: readonly (TtscProjectMutationTracker | undefined)[],
): Promise<void> {
  const trackers = candidates.filter(
    (tracker): tracker is TtscProjectMutationTracker => tracker !== undefined,
  );
  await Promise.all(
    trackers.map(async (tracker) => {
      tracker.settle ??= (tracker.drain ?? drainOnNextTurn)()
        .then((held) => {
          if (!held) tracker.unverified = true;
        })
        .finally(() => {
          tracker.settle = undefined;
        });
      await tracker.settle;
    }),
  );
}
