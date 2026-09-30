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
 * @evidence contracts/testing.md#behavioral-verification An upstream whose getCacheKey throws leaves the authored getCacheKey callable with a 64-character result.
 * @evidence contracts/testing.md#independent-expectations The fixture throws a literal upstream key failure; nonfatal result shape is the independent oracle retained by this case.
 * @evidence contracts/testing.md#distinguishing-cases Callback failure contrasts module-resolution failure. This case does not assert nonce inequality or successful transformation.
 * @evidence contracts/testing.md#execution-ownership This matching src/unit export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_cache_key_survives_a_throwing_upstream_cache_key =
  async () => {
    await assertCacheKeySurvivesThrowingUpstreamCacheKey();
  };
