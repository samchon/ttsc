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
 */
export async function settleProjectMutationEvents(
  cached: TtscCachedProjectTransform,
): Promise<void> {
  await settleMutationTrackers([
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
    cached.candidateMutationTracker,
  ]);
}
