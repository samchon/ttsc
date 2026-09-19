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
