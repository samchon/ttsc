import { assertCacheKeySurvivesMissingUpstream } from "../../internal/metro-transform";

/**
 * Verifies getCacheKey survives a missing upstream transformer.
 *
 * Metro computes the transformer cache key eagerly. If resolving the upstream
 * (only needed to read its optional getCacheKey) threw, the whole build would
 * die during cache keying. Resolution failure must degrade to no upstream
 * contribution by using a nonce, without throwing or permitting stale reuse.
 *
 * 1. Configure an unresolvable `upstreamTransformer`.
 * 2. Call getCacheKey twice for one prepared project through fresh modules.
 * 3. Assert each key is a 64-char hex digest and the keys differ.
 *
 * @evidence contracts/testing.md#behavioral-verification getCacheKey with upstreamTransformer set to an unresolvable module name returns different 64-character hex strings across two fresh modules using the same prepared project.
 * @evidence contracts/testing.md#independent-expectations The documented failed-upstream policy withdraws reuse without throwing, so authored hex-shape and inequality expectations do not recompute a digest. Neighboring successful-upstream entries establish stable prepared-project keying.
 * @evidence contracts/testing.md#distinguishing-cases Missing upstream is isolated from missing snapshot by preparing one unchanged project. A throwing upstream callback and an absent optional callback are contrasting neighboring entries.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls prepareSnapshot and getCacheKey in-process with a worker environment naming a nonexistent upstream; no native compile, consumer install or Metro host.
 */
export const test_cache_key_survives_a_missing_upstream = async () => {
  await assertCacheKeySurvivesMissingUpstream();
};
