import { assertCacheKeyIgnoresOutputInAnUnlistedDirectory } from "../../internal/metro-cache";

/**
 * Verifies emitted output in an unnamed directory leaves the cache key alone.
 *
 * See {@link assertCacheKeyIgnoresOutputInAnUnlistedDirectory}: the Metro half
 * of samchon/ttsc#1307, required by samchon/ttsc#1317 and missing when that
 * work merged.
 */
export const test_cache_key_ignores_output_in_an_unlisted_directory =
  async () => {
    await assertCacheKeyIgnoresOutputInAnUnlistedDirectory();
  };
