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
 * @evidence contracts/performance.md#efficient-algorithms One keyed identity check and deletion selects cleanup without scanning or clearing unrelated entries.
 * @evidence contracts/performance.md#reuse-equivalent-work A newer authoritative promise remains available instead of triggering a redundant third compile after an older failure.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The evicted fulfilled generation reaches the shared disposer, while stale cleanup cannot detach its replacement.
 */
export function evictGeneration(
  cache: TtscTransformCache | undefined,
  key: string,
  generation: Promise<TtscCachedProjectTransform>,
): void {
  if (cache?.get(key) === generation) {
    cache.delete(key);
    void generation.then(disposeCachedTransform, () => undefined);
  }
}
