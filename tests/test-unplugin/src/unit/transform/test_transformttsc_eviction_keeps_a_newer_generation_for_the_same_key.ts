import assert from "node:assert/strict";

import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies a failed generation's cleanup cannot remove a newer generation
 * installed under the same key.
 *
 * Eviction is identity-guarded: it deletes the entry only while the cache still
 * holds the exact failed generation. Replacing the failed generation after the
 * failing call began waiting, but before its eviction ran, pins that guard.
 *
 * 1. Supply a literal settled-pass generation and install a rejected generation under its key.
 * 2. Start a delivery, then install a newer generation under the same key.
 * 3. Assert the delivery rejects and the newer generation survives.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual authored transformTtsc executes its awaited-generation identity and eviction/retry paths. Rejected stale Promise surfaces its error while identity-guarded eviction preserves the newer fulfilled Promise.
 * @evidence contracts/testing.md#independent-expectations The literal stale-generation error and exact newer Promise identity specify rejection propagation and guarded deletion independently of the cache implementation; this case does not assert transformed output.
 * @evidence contracts/testing.md#distinguishing-cases Rejected stale Promise surfaces its error while identity-guarded eviction preserves the newer fulfilled Promise. The neighboring rejection, matching-stale and mismatching-stale distinctions execute in separate named units.
 * @evidence contracts/testing.md#execution-ownership This named source unit drives the actual delivery coordinator with a literal settled-pass generation and real cheap config/source inputs, then resets its local cache in finally. It neither runs a native producer nor claims its handwritten generation proves capture; actual rejection/exception-to-native-recovery remains in the two surviving recovery E2E cases.
 */
export async function test_transformttsc_eviction_keeps_a_newer_generation_for_the_same_key(): Promise<void> {
  const fixture = createCachedDeliveryUnitFixture();
  const { api, cache, key, good, file, source, options } = fixture;

  try {
    const stale = Promise.reject<TtscCachedProjectTransform>(new Error("stale generation"));
    stale.catch(() => undefined);
    cache.set(key, stale);
    const newer = Promise.resolve(good);

    // transformTtsc runs synchronously up to `await` on the stale generation, then
    // yields. Swap in the newer generation before the rejection eviction fires.
    const pending = api.transformTtsc(file, source, options, undefined, cache);
    cache.set(key, newer);

    await assert.rejects(() => pending, /stale generation/);
    assert.equal(
      cache.get(key),
      newer,
      "stale generation's eviction must not remove the newer entry",
    );
  } finally {
    fixture.dispose();
  }
}
