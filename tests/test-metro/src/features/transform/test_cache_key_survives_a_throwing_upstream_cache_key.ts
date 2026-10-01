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
 *
 * @evidence contracts/testing.md#behavioral-verification getCacheKey with a resolvable fake upstream whose getCacheKey throws returns a 64-character string instead of throwing.
 * @evidence contracts/testing.md#independent-expectations The fixture throws a literal Error("upstream getCacheKey boom"); the nonfatal contract is checked only as string type and width, not as a nonce.
 * @evidence contracts/testing.md#distinguishing-cases Only the throwing-callback failure is run; the missing-upstream failure belongs to the neighboring entry, and no cross-run key comparison is made.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls the transformer module's getCacheKey in-process with a temp CommonJS upstream; no snapshot, native compile, consumer install or Metro host.
 */
export const test_cache_key_survives_a_throwing_upstream_cache_key =
  async () => {
    await assertCacheKeySurvivesThrowingUpstreamCacheKey();
  };
