import type { TtscProjectMutationTracker } from "./TtscProjectMutationTracker";

/**
 * Yield to the loop the tracker's own watcher callbacks are queued on.
 *
 * Two turns for the same reason the broker takes two: the first gives the loop
 * a poll phase for completions the kernel had already queued, the second runs
 * after the callbacks they produced.
 */
function drainOnNextTurn(): Promise<void> {
  return new Promise<void>((resolve) =>
    setImmediate(() => setImmediate(resolve)),
  );
}

/** Settle one set of optional trackers through one shared barrier each. */
export async function settleMutationTrackers(
  candidates: readonly (TtscProjectMutationTracker | undefined)[],
): Promise<void> {
  const trackers = candidates.filter(
    (tracker): tracker is TtscProjectMutationTracker => tracker !== undefined,
  );
  await Promise.all(
    trackers.map(async (tracker) => {
      tracker.settle ??= (tracker.drain ?? drainOnNextTurn)().finally(() => {
        tracker.settle = undefined;
      });
      await tracker.settle;
    }),
  );
}
