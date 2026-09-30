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
 *
 * @evidence contracts/testing.md#behavioral-verification Different enableBabelRCLookup values reach the upstream key and change the composed key; an upstream without getCacheKey still yields a 64-character key.
 * @evidence contracts/testing.md#independent-expectations The upstream fixture independently echoes its input, so the authored boolean difference must contribute to key inequality; an optional callback may be omitted.
 * @evidence contracts/testing.md#distinguishing-cases Forwarded true/false contrasts absence of the optional upstream callback under one project snapshot.
 * @evidence contracts/testing.md#execution-ownership This matching src/unit export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_cache_key_forwards_and_folds_the_upstream_key = async () => {
  await assertCacheKeyForwardsAndFoldsUpstreamKey();
};
