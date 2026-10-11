import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { settleMutationTrackers } from "./settleMutationTrackers";

/**
 * Await the cached trackers' drain operations before persistent validation
 * reads their verdicts.
 *
 * A synchronous edit returns before its watch event is applied, so without this
 * a delivery could validate against a tracker that has not been told yet. Each
 * tracker uses its supplied native drain or the local two-immediate fallback;
 * that fallback is a scheduling opportunity, not independent native delivery
 * proof. Concurrent sibling deliveries share an in-flight tracker drain. Drain
 * rejection aborts the delivery's settlement and does not cancel sibling
 * drains.
 *
 * The watched directories' identities are not checked here but by the
 * delivery's synchronous admission (`verifyGenerationLocations`), after its
 * last await, so a directory replaced while the delivery prepared is still
 * caught and its reading is current when a validator reuses it.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Successful aggregate completion precedes admission. Missing backend
 *   delivery premises are not supplied by this adapter; the caller still
 *   decides whether silence has authority.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One three-tracker list drives drainage; directory identity belongs to the
 *   synchronous admission that reads it.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The operation does not patch watcher paths or certify a generation from a
 *   timeout alone.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain event ordering and where location verification
 *   moved, under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral delivery uses backend-owned drains.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Three tracker slots are drained concurrently; delegated drain work remains
 *   a variable cost.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   In-flight drainage is shared by concurrent sibling deliveries.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Pending drains retain the cached tracker references until they settle;
 *   rejection does not cancel siblings and no aggregate deadline is supplied.
 *   Tracker owners still control backend task and watcher closure.
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
