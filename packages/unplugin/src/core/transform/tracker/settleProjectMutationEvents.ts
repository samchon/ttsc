import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { settleMutationTrackers } from "./settleMutationTrackers";

/**
 * Settle every notification the trackers' watchers have already dispatched,
 * before persistent validation reads their verdict.
 *
 * A synchronous edit returns before its watch event is applied, so without this
 * a delivery could validate against a tracker that has not been told yet. Each
 * tracker drains through its own channel, which is a macrotask turn for a
 * watcher on this loop and an ordered round-trip for one inside the Windows
 * broker. Concurrent sibling deliveries share the barrier one of them started.
 * Each tracker then confirms its watched directories are still the ones it
 * opened on, so a replaced directory withdraws the tracker instead of leaving
 * its silence to stand as proof. The trackers share what they read, so a
 * directory they all watch, the project root above all, costs one metadata call
 * per delivery rather than one per tracker.
 */
export async function settleProjectMutationEvents(
  cached: TtscCachedProjectTransform,
): Promise<void> {
  const trackers = [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
    cached.candidateMutationTracker,
  ];
  await settleMutationTrackers(trackers);
  // A watch that now observes a replaced directory has nothing left to say
  // about the new one, so it gives up its authority before anything reads it.
  const seen = new Map<string, string | undefined>();
  for (const tracker of trackers) tracker?.verifyLocations?.(seen);
}
