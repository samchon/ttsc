import assert from "node:assert/strict";

import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies a stale generation's input mismatch neither deletes nor bypasses a
 * newer generation installed meanwhile.
 *
 * A caller awaits a generation whose source proof is stale. If a sibling has
 * replaced its Promise before it resolves, the coordinator retries the new
 * entry before interpreting the old proof; it must neither evict the sibling
 * nor start a third compile. This case owns the pre-validation replacement
 * branch, not the separate source-validation decision.
 *
 * 1. Supply a literal settled-pass generation, and install a pending stale generation under
 *    its key.
 * 2. Start a delivery, install a newer generation, then resolve the stale one with
 *    mismatching hashes.
 * 3. Assert the delivery is transformed and the newer generation remains cached.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual authored transformTtsc checks the awaited generation's Promise identity and retries the newer cache entry before validating the old proof. A stale value resolves with missing hashes after a sibling replacement; the authoritative newer generation must survive and supply output. No eviction or rejection is exercised.
 * @evidence contracts/testing.md#independent-expectations The expected output is the fixture's literal transformed text (checked by regex and by equality), the replacement Promise identity left in the cache is the oracle for retry, and the fixture's source hash uses Node SHA-256, not the product hash helper. The stale generation here is the good generation with its inputHashes emptied; there is no rejection case.
 * @evidence contracts/testing.md#distinguishing-cases One scenario: a pending generation resolves with empty inputHashes after a sibling installed a newer Promise. The delivery must return the newer generation's output and leave the newer Promise cached; delivering from the stale generation, evicting the newer one or recompiling would fail. Other stale variants are not exercised.
 * @evidence contracts/testing.md#execution-ownership Unit test: drives the real transformTtsc with a manually resolved pending stale Promise, a handwritten fulfilled newer generation and real temporary config/source files, and disposes the fixture cache in finally. No native producer runs, and the handwritten generation is not claimed to prove a real capture.
 */
export async function test_transformttsc_retries_a_newer_generation_after_a_stale_input_mismatch(): Promise<void> {
  const fixture = createCachedDeliveryUnitFixture();
  const { api, cache, key, good, file, source, options } = fixture;

  try {
    let resolveStale!: (value: TtscCachedProjectTransform) => void;
    const stale = new Promise<TtscCachedProjectTransform>((resolve) => {
      resolveStale = resolve;
    });
    cache.set(key, stale);
    const pending = api.transformTtsc(file, source, options, undefined, cache);

    const newer = Promise.resolve(good);
    cache.set(key, newer);
    resolveStale({
      ...good,
      inputHashes: {},
    });

    const result = await pending;
    assert.ok(result);
    assert.match(result.code, /PLUGIN/);
    assert.doesNotMatch(result.code, /goUpper/);
    assert.equal(result.code, fixture.code);
    assert.equal(
      cache.get(key),
      newer,
      "a stale mismatch must retry the authoritative newer generation",
    );
  } finally {
    fixture.dispose();
  }
}
