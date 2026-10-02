import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { settleMutationTrackers } from "./settleMutationTrackers";

/**
 * Await the cached trackers' drain operations, then recheck their watched
 * directory identities before persistent validation reads their verdicts.
 *
 * A synchronous edit returns before its watch event is applied, so without this
 * a delivery could validate against a tracker that has not been told yet. Each
 * tracker uses its supplied native drain or the local two-immediate fallback;
 * that fallback is a scheduling opportunity, not independent native delivery
 * proof. Concurrent sibling deliveries share an in-flight tracker drain.
 * Each tracker with a verifier then checks its watched directories against those it
 * opened on, so a replaced directory withdraws the tracker instead of leaving
 * its silence to stand as proof. The trackers share what they read, so a
 * directory they all watch, the project root above all, costs one metadata call
 * per invocation rather than one per tracker. This map assumes those callbacks
 * share a coherent filesystem view; it is not an atomic snapshot. Drain
 * rejection aborts this verification phase and does not cancel sibling drains.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Successful aggregate completion precedes the available directory verifiers.
 *   Missing optional verifiers and backend delivery premises are not supplied
 *   by this adapter; the caller still decides whether silence has authority.
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
 *   Three tracker slots are visited after concurrent drainage. Existing
 *   verifiers scan their retained watched locations, sharing one metadata read
 *   per exact directory spelling; native path traversal, key bytes and bigint
 *   identity formatting plus delegated drain work remain variable costs.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   In-flight drainage is shared by tracker and identity observations by this
 *   delivery's map; the map is recreated for every delivery, not cached forever.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The identity map is local to the post-drain verification call, retaining
 *   queried directory/identity text with no independent population/byte cap.
 *   Pending drains retain the cached tracker references until they settle;
 *   rejection does not cancel siblings and no aggregate deadline is supplied.
 *   Tracker owners still control backend task and watcher closure.
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
