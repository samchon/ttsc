import { TRANSFORM_CACHE_EPOCHS } from "./TRANSFORM_CACHE_EPOCHS";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * The pass a delivery belongs to, or `undefined` under persistent validation.
 *
 * @evidence contracts/common.md#principled-implementation The cache's declared epoch determines pass scope, and an absent cache or declaration yields persistent validation.
 * @evidence contracts/common.md#clear-and-simple-design A read-only WeakMap lookup exposes the existing lifecycle state without advancing or inventing a pass.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Undefined remains the absence of a pass, not a fabricated epoch authorizing narrow replay.
 * @evidence contracts/common.md#meaningful-documentation The comment defines the returned pass identity and the meaning of undefined.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One WeakMap lookup.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A read of existing lifecycle state; there is no computation to share.
 */
export function transformCacheEpoch(
  cache: TtscTransformCache | undefined,
): number | undefined {
  return cache === undefined ? undefined : TRANSFORM_CACHE_EPOCHS.get(cache);
}
