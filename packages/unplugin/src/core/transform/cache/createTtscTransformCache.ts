import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { TRANSFORM_CACHE_FILESYSTEM } from "./TRANSFORM_CACHE_FILESYSTEM";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Create an empty persistent transform cache with isolated filesystem reads.
 *
 * @evidence contracts/common.md#principled-implementation Each cache receives its own filesystem operation table, so supplied capabilities govern that cache without changing defaults for other adapters.
 * @evidence contracts/common.md#clear-and-simple-design A Map stores compile promises and a WeakMap stores its operation table; omitted operations independently use the native defaults.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit dependency injection supplies filesystem capabilities without replacing foreign methods or adding test-specific behavior.
 * @evidence contracts/common.md#meaningful-documentation The comment describes the empty cache and isolated reads; the parameter type distinguishes required native defaults from optional watch and case-policy capabilities.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The cache holds promises only. Its generations' watchers and probes are released through resetTtscTransformCache and evictGeneration, and the operation table sits in a WeakMap keyed by the cache.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Allocates one Map and one operation table.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Creates a new cache by definition; sharing one between adapters is decided by sharedBuildTransformCache.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 */
export function createTtscTransformCache(
  operations: Partial<TtscTransformFilesystemOperations> = {},
): TtscTransformCache {
  const cache: TtscTransformCache = new Map();
  TRANSFORM_CACHE_FILESYSTEM.set(cache, {
    caseSensitive: operations.caseSensitive,
    exists: operations.exists ?? DEFAULT_FILESYSTEM_OPERATIONS.exists,
    lstat: operations.lstat ?? DEFAULT_FILESYSTEM_OPERATIONS.lstat,
    readFile: operations.readFile ?? DEFAULT_FILESYSTEM_OPERATIONS.readFile,
    readdir: operations.readdir ?? DEFAULT_FILESYSTEM_OPERATIONS.readdir,
    realpath: operations.realpath ?? DEFAULT_FILESYSTEM_OPERATIONS.realpath,
    stat: operations.stat ?? DEFAULT_FILESYSTEM_OPERATIONS.stat,
    statBigInt:
      operations.statBigInt ?? DEFAULT_FILESYSTEM_OPERATIONS.statBigInt,
    platform: operations.platform,
    watch: operations.watch,
  });
  return cache;
}
