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
 */
export const test_cache_key_survives_a_missing_upstream = async () => {
  await assertCacheKeySurvivesMissingUpstream();
};
