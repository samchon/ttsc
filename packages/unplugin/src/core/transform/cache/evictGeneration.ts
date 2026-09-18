import type { TtscCachedProjectTransform } from "./TtscCachedProjectTransform";
import type { TtscTransformCache } from "./TtscTransformCache";
import { disposeCachedTransform } from "./disposeCachedTransform";

/**
 * Delete a failed generation from the cache only when it is still the entry
 * stored under `key`. The identity check prevents an older failed generation's
 * cleanup from removing a newer replacement created by another caller for the
 * same key.
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
