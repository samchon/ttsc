import { assertCacheKeySurvivesMissingUpstream } from "../../internal/metro-transform";

/**
 * Verifies getCacheKey survives a missing upstream transformer.
 *
 * Metro computes the transformer cache key eagerly. If resolving the upstream
 * (only needed to read its optional getCacheKey) threw, the whole build would
 * die during cache keying. Resolution failure must degrade to no upstream
 * contribution, not throw.
 *
 * 1. Configure an unresolvable `upstreamTransformer`.
 * 2. Call getCacheKey.
 * 3. Assert it returns a valid 64-char hex digest instead of throwing.
 *
 * @evidence contracts/testing.md#behavioral-verification An unresolved configured upstream leaves getCacheKey callable with a 64-character result.
 * @evidence contracts/testing.md#independent-expectations The cache operation remains nonfatal when upstream resolution fails; literal string type and width pin that limited original assertion.
 * @evidence contracts/testing.md#distinguishing-cases Absent upstream contrasts a throwing key callback. This case does not assert nonce inequality or actual transform success.
 * @evidence contracts/testing.md#execution-ownership This matching src/unit export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_cache_key_survives_a_missing_upstream = async () => {
  await assertCacheKeySurvivesMissingUpstream();
};
