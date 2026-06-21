import { assertCacheKeySurvivesThrowingUpstreamCacheKey } from "../../internal/metro-transform";

/**
 * Verifies getCacheKey survives an upstream whose getCacheKey throws.
 *
 * The upstream is resolved and present, but its `getCacheKey` throws. The
 * adapter's inner guard must swallow that and still return a valid key rather
 * than letting one transformer's bug crash the whole build's cache keying.
 *
 * 1. Configure an upstream whose getCacheKey throws.
 * 2. Call getCacheKey.
 * 3. Assert it returns a valid 64-char hex digest instead of throwing.
 */
export const test_cache_key_survives_a_throwing_upstream_cache_key =
  async () => {
    await assertCacheKeySurvivesThrowingUpstreamCacheKey();
  };
