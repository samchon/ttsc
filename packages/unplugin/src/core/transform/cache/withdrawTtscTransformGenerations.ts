import { disposeCachedTransform } from "./disposeCachedTransform";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Withdraw every generation while preserving the host's current delivery pass.
 *
 * Volatile input observations disqualify reuse without ending a one-shot build.
 * Clear membership immediately; fulfilled pending generations subsequently
 * attempt owned tracker/probe cleanup. No compilation is cancelled here.
 *
 * @evidence contracts/common.md#principled-implementation Generation withdrawal clears only cached promises; the host's epoch stays authoritative until its actual terminal lifecycle boundary.
 * @evidence contracts/common.md#clear-and-simple-design One operation shares generation disposal between volatile withdrawal and terminal reset without conflating their lifecycle authority.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Incomplete observation actually withdraws reusable entries; it does not invent a new pass or mark metadata that no owner consumes.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish immediate membership withdrawal, scheduled resource cleanup and the retained delivery pass, without promising successful native release.
 * @evidence contracts/performance.md#efficient-algorithms
 *   An O(N) promise snapshot is followed by one N-entry reaction scheduling
 *   pass and membership clear, without serially awaiting compilation. Fulfilled
 *   reactions additionally delegate each generation's watcher/probe cleanup;
 *   snapshots and reactions require temporary population-sized storage.
 * @evidence contracts/performance.md#reuse-equivalent-work Terminal reset and volatile withdrawal share the same generation disposal operation; complete ordinary pass opening retains its existing reuse policy.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Membership is cleared before attaching reactions. Each fulfilled withdrawn
 *   promise transfers its generation to the disposer; rejection is consumed.
 *   Pending reactions have no cancellation/settlement deadline, and failed
 *   native cleanup can leave underlying resources despite detached ownership.
 *   The delivery epoch is deliberately retained by its separate owner.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Fulfilled generation cleanup uses its actual supplied native tracker and
 *   clock-probe owners, without platform-name assumptions about close/removal
 *   success. This coordinator keeps configuration keys opaque and preserves
 *   the caller's lifecycle boundary separately from native cleanup.
 */
export function withdrawTtscTransformGenerations(
  /** Cache whose generations are withdrawn while its delivery pass survives. */
  cache: TtscTransformCache,
): void {
  const generations = [...cache.values()];
  cache.clear();
  for (const generation of generations) {
    void generation.then(disposeCachedTransform, () => undefined);
  }
}
