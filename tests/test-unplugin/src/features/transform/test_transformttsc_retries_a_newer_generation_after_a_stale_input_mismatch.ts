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
 * @evidence contracts/testing.md#behavioral-verification Actual authored transformTtsc executes its awaited-generation identity and eviction/retry paths. A stale value resolves with missing hashes after a sibling replacement; the authoritative newer generation must survive and supply output.
 * @evidence contracts/testing.md#independent-expectations Literal good and stale outputs, exact Promise identity and rejection text independently specify the concurrent-cache protocol; fixture source hashes use Node SHA-256, not the product hash helper.
 * @evidence contracts/testing.md#distinguishing-cases A stale value resolves with missing hashes after a sibling replacement; the authoritative newer generation must survive and supply output. The neighboring rejection, matching-stale and mismatching-stale distinctions execute in separate named units.
 * @evidence contracts/testing.md#execution-ownership This named source unit drives the actual delivery coordinator with a literal settled-pass generation and real cheap config/source inputs, then resets its local cache in finally. It neither runs a native producer nor claims its handwritten generation proves capture; actual rejection/exception-to-native-recovery remains in the two surviving recovery E2E cases.
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
