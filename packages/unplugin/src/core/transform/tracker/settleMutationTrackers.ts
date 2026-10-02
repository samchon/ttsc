import type { TtscProjectMutationTracker } from "./TtscProjectMutationTracker";

/**
 * Yield to the loop the tracker's own watcher callbacks are queued on.
 *
 * Two immediate turns allow a poll phase and its queued callbacks before the
 * fallback resolves. This scheduling opportunity is not independent proof of
 * native notification completeness or write-to-kernel completion ordering.
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
 * A rejected drain rejects this aggregate rather than setting that flag. Other
 * started drains still run; this operation does not cancel or close them.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Each tracker uses its supplied drain or the local scheduling fallback. A
 *   fulfilled false verdict marks it unverified; rejection propagates. A true
 *   verdict retains the backend's premises, not an independent coverage proof.
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
 *   Filtering and aggregate scheduling use O(n) candidate references/promises,
 *   including duplicate candidates that await the same tracker promise. Native
 *   request, scope, text and callback work belongs to each reached drain and is
 *   still part of this operation; independent drains start concurrently.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Concurrent deliveries share tracker.settle only while the same channel's
 *   barrier is in flight; finally clears it so later events require a new drain.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Each tracker holds one settle promise until its drain settles, then finally
 *   clears it. There is no aggregate deadline/cancellation: a never-settling
 *   drain retains that reference and waiting callers, including after a sibling
 *   rejection. Native request cleanup and tracker closure remain backend-owned.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   This Promise scheduler performs no native filesystem/path/process boundary
 *   operation. Native delivery premises belong to supplied drains; the local
 *   two-turn fallback makes no platform capability or completeness claim.
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
