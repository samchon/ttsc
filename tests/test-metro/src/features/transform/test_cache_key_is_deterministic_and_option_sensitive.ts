import { assertCacheKeyIsDeterministicAndOptionSensitive } from "../../internal/metro-transform";

/**
 * Verifies getCacheKey is deterministic and option-sensitive.
 *
 * Metro folds the transformer's cache key into its persistent transform cache.
 * The key must be stable for identical options (so cache hits work) yet change
 * when options change (so stale transforms are not served). A non-stable
 * stringify or a missing option input would break one side or the other.
 *
 * 1. Compute getCacheKey twice for the same options.
 * 2. Assert it is a 64-char hex digest, equal across the two calls.
 * 3. Compute it for a different option set and assert it differs.
 */
export const test_cache_key_is_deterministic_and_option_sensitive =
  async () => {
    await assertCacheKeyIsDeterministicAndOptionSensitive();
  };
