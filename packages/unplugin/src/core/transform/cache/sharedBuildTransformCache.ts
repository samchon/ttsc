import { SHARED_BUILD_TRANSFORM_CACHES } from "./SHARED_BUILD_TRANSFORM_CACHES";
import type { TtscSharedBuildTransformCache } from "./TtscSharedBuildTransformCache";
import { createTransformCacheLease } from "./createTransformCacheLease";
import { createTtscTransformCache } from "./createTtscTransformCache";

/**
 * The process's build-scoped cache for one set of resolved options, created on
 * first use (samchon/ttsc#1396).
 *
 * @param key A stable serialization of the resolved options.
 */
export function sharedBuildTransformCache(
  key: string,
): TtscSharedBuildTransformCache {
  let entry = SHARED_BUILD_TRANSFORM_CACHES.get(key);
  if (entry === undefined) {
    const cache = createTtscTransformCache();
    entry = { cache, lease: createTransformCacheLease(cache) };
    SHARED_BUILD_TRANSFORM_CACHES.set(key, entry);
  }
  return entry;
}
