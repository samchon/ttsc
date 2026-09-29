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
 *
 * @evidence contracts/common.md#principled-implementation
 *   Drainage precedes watched-directory identity verification so recorded
 *   silence is read only after queued events and replacement checks.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One three-tracker list drives both phases; a delivery-local identity map
 *   shares metadata without adding persistent validity state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A replaced watched directory withdraws authority; the operation does not
 *   patch watcher paths or certify a generation from a timeout alone.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain event ordering, directory replacement and shared
 *   verification under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral delivery uses backend-owned drains and filesystem-owned physical
 *   identities; lexical aliases cannot prove a replaced directory unchanged.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Three trackers are visited once after concurrent drainage; identity reads
 *   scale with distinct watched directory spellings across those trackers.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   In-flight drainage is shared by tracker and identity observations by this
 *   delivery's map; the map is recreated for every delivery, not cached forever.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The identity map lasts for this verification call and stores at most the
 *   distinct queried directories; tracker-owned drains release their own tasks.
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
