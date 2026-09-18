import { TRANSFORM_CACHE_EPOCHS } from "./TRANSFORM_CACHE_EPOCHS";
import type { TtscTransformCache } from "./TtscTransformCache";
import { disposeCachedTransform } from "./disposeCachedTransform";

/**
 * Discard every generation, dispose its watchers, and return the cache to
 * persistent validation mode.
 *
 * This is the unconditional lifecycle boundary, and it is distinct from
 * {@link beginTtscTransformBuild}: a pass ending is not a reason to throw a
 * proven compile away, while a session ending is.
 */
export function resetTtscTransformCache(cache: TtscTransformCache): void {
  clearTtscTransformCache(cache);
  TRANSFORM_CACHE_EPOCHS.delete(cache);
}

/** Dispose generation-owned filesystem resources before clearing a cache. */
function clearTtscTransformCache(cache: TtscTransformCache): void {
  const generations = [...cache.values()];
  cache.clear();
  for (const generation of generations) {
    void generation.then(disposeCachedTransform, () => undefined);
  }
}
