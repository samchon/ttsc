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
 * 1. Compute getCacheKey for one prepared project with `enableBabelRCLookup`
 *    true and false against an upstream whose key echoes its arguments; assert they differ.
 * 2. Compute getCacheKey against an upstream that has no getCacheKey.
 * 3. Assert that still yields a stable 64-character string key across fresh modules.
 *
 * @evidence contracts/testing.md#behavioral-verification getCacheKey for one prepared project returns different keys for enableBabelRCLookup true versus false when the fake upstream's getCacheKey echoes its arguments, and returns the same 64-character string across fresh modules when the upstream exports no getCacheKey.
 * @evidence contracts/testing.md#independent-expectations The fake upstream key is a JSON echo of its first argument, so the authored true/false difference can only reach the result through forwarding; literal type, width and repeat equality establish the usable stable key required when an optional callback is absent.
 * @evidence contracts/testing.md#distinguishing-cases A forwarded-argument change (inequality) and an upstream without getCacheKey (stable valid key) are separate checks; the latter uses a different upstream module and is compared only against its own repeat, distinguishing an absent optional callback from a failing callback.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls prepareSnapshot and getCacheKey from freshly loaded transformer modules in-process, with fake CommonJS upstreams written to a temp directory; no native compile, consumer install or Metro host.
 */
export const test_cache_key_forwards_and_folds_the_upstream_key = async () => {
  await assertCacheKeyForwardsAndFoldsUpstreamKey();
};
