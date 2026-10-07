import type { TtscCachedProjectTransform } from "./TtscCachedProjectTransform";
import type { TtscTransformCache } from "./TtscTransformCache";
import { disposeCachedTransform } from "./disposeCachedTransform";

/**
 * Delete a generation that failed, or was found unfit to serve, from the cache
 * only when it is still the entry stored under `key`. The identity check
 * prevents an older generation's cleanup from removing a newer replacement
 * created by another caller for the same key.
 *
 * @evidence contracts/common.md#principled-implementation Promise identity guards deletion, so late cleanup of an old generation cannot remove a newer compile under the same configuration key.
 * @evidence contracts/common.md#clear-and-simple-design One guarded delete schedules the existing generation disposer after fulfillment; rejected promises have no fulfilled generation to dispose.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cleanup follows owned entry identity rather than treating every failure as grounds to clear other callers' cache entries.
 * @evidence contracts/common.md#meaningful-documentation The comment describes the replacement race and why identity, rather than key equality alone, controls eviction.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One keyed identity check/deletion schedules cleanup without scanning other
 *   cache entries; key access carries supplied string cost. Fulfilled cleanup
 *   delegates disposal of the generation's W watchers and owned clock probe,
 *   rather than making that work constant through Promise scheduling.
 * @evidence contracts/performance.md#reuse-equivalent-work A newer authoritative promise remains available instead of triggering a redundant third compile after an older failure.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The matching entry is removed immediately; its reaction awaits fulfillment
 *   before the shared disposer attempts independent native cleanup. Rejections
 *   are consumed, but this gate has no compile-cancellation deadline. A stale
 *   promise cannot detach its replacement or schedule that replacement's cleanup.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Cleanup invokes the generation's supplied notification close capabilities
 *   and owned clock-probe removal, preserving its native observing view rather
 *   than assuming platform-independent close/removal success. Key comparison
 *   remains opaque cache identity, not path canonicalization.
 */
export function evictGeneration(
  /** Cache whose current entry alone may transfer to cleanup. */
  cache: TtscTransformCache | undefined,
  /** Opaque configuration address, not a filesystem spelling. */
  key: string,
  /** Expected current owner; a later replacement must survive. */
  generation: Promise<TtscCachedProjectTransform>,
): void {
  if (cache?.get(key) === generation) {
    cache.delete(key);
    void generation.then(disposeCachedTransform, () => undefined);
  }
}
