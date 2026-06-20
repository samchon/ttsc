import { assertCacheKeyForwardsAndFoldsUpstreamKey } from "../../internal/metro-transform";

/**
 * Verifies getCacheKey forwards Metro's args to, and folds in, the upstream
 * key.
 *
 * Metro calls getCacheKey with `{ projectRoot, enableBabelRCLookup }`. The
 * adapter must forward those to the upstream transformer's getCacheKey so a
 * `babel.config.js`/projectRoot change still busts the cache, and must still
 * produce a valid key when the upstream exposes no getCacheKey.
 *
 * 1. Compute getCacheKey with two different forwarded projectRoots; assert they
 *    differ.
 * 2. Compute getCacheKey against an upstream that has no getCacheKey.
 * 3. Assert that still yields a valid 64-char hex digest.
 */
export const test_cache_key_forwards_and_folds_the_upstream_key = async () => {
  await assertCacheKeyForwardsAndFoldsUpstreamKey();
};
