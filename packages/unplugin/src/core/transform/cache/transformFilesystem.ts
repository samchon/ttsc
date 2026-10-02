import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { TRANSFORM_CACHE_FILESYSTEM } from "./TRANSFORM_CACHE_FILESYSTEM";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Return the filesystem view a delivery through `cache` must use.
 *
 * A cache created by `createTtscTransformCache` carries the operations it was
 * created with, which may observe a filesystem other than the host's. A
 * delivery without a cache, or through a cache created elsewhere, uses the host
 * filesystem.
 *
 * @evidence contracts/common.md#principled-implementation Deliveries use the cache's declared filesystem operations; absent or unregistered caches use the actual host defaults.
 * @evidence contracts/common.md#clear-and-simple-design One capability lookup selects the view without copying snapshots or adding another filesystem abstraction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit view selection avoids foreign-method monkeypatching and preserves the distinction between injected and native observations.
 * @evidence contracts/common.md#meaningful-documentation The native prose states both ownership by cache construction and the exact fallback cases.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing; the table is weakly keyed by the cache.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One WeakMap lookup.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The lookup returns the operation table the cache was created with; there is no computation to share.
 */
export function transformFilesystem(
  cache: TtscTransformCache | undefined,
): TtscTransformFilesystemOperations {
  return (
    (cache === undefined ? undefined : TRANSFORM_CACHE_FILESYSTEM.get(cache)) ??
    DEFAULT_FILESYSTEM_OPERATIONS
  );
}
