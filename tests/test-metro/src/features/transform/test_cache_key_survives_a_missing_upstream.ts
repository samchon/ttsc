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
 * @evidence contracts/testing.md#behavioral-verification getCacheKey with upstreamTransformer set to an unresolvable module name and a nonexistent projectRoot returns a 64-character string instead of throwing.
 * @evidence contracts/testing.md#independent-expectations The nonfatal-keying contract is checked as a literal string type and width only; the key's value, and whether it is a nonce, are not asserted.
 * @evidence contracts/testing.md#distinguishing-cases Only the unresolvable-upstream failure is run here. A throwing upstream key callback is covered by the neighboring entry, and no equal-or-different comparison between runs is made.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls the transformer module's getCacheKey in-process with a worker environment naming a nonexistent upstream; no snapshot, native compile, consumer install or Metro host.
 */
export const test_cache_key_survives_a_missing_upstream = async () => {
  await assertCacheKeySurvivesMissingUpstream();
};
