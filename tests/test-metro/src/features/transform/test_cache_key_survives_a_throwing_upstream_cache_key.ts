import { assertCacheKeySurvivesThrowingUpstreamCacheKey } from "../../internal/metro-transform";

/**
 * Verifies getCacheKey survives an upstream whose getCacheKey throws.
 *
 * The upstream is resolved and present, but its `getCacheKey` throws. The
 * adapter's inner guard must swallow that and still return a valid key rather
 * than letting one transformer's bug crash the whole build's cache keying. The
 * failure also withdraws reuse with a nonce.
 *
 * 1. Configure an upstream whose getCacheKey throws.
 * 2. Call getCacheKey twice for one prepared project through fresh modules.
 * 3. Assert each key is a 64-char hex digest and the keys differ.
 *
 * @evidence contracts/testing.md#behavioral-verification getCacheKey with a resolvable fake upstream whose getCacheKey throws returns different 64-character hex strings across fresh modules using the same prepared project.
 * @evidence contracts/testing.md#independent-expectations The fixture throws the authored sentinel upstream getCacheKey boom; the contract requires nonfatal keying and withdrawal of reuse, checked with hex shape and inequality rather than a recomputed digest.
 * @evidence contracts/testing.md#distinguishing-cases A throwing callback is isolated from missing snapshot by preparing one unchanged project. Missing upstream and absent optional callback are contrasting neighboring entries, the latter retaining stable keys.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls prepareSnapshot and getCacheKey in-process with a temp CommonJS upstream; no native compile, consumer install or Metro host.
 */
export const test_cache_key_survives_a_throwing_upstream_cache_key =
  async () => {
    await assertCacheKeySurvivesThrowingUpstreamCacheKey();
  };
