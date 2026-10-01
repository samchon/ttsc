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
 * @evidence contracts/testing.md#distinguishing-cases One scenario: a rejected stale generation is replaced by a fulfilled one while the delivery awaits it. The delivery must reject with the stale error and the cache must still hold the newer Promise, so a cleanup that deleted by key instead of by identity would fail. Successful delivery from the newer generation is not asserted.
 * @evidence contracts/testing.md#execution-ownership Unit test: drives the real transformTtsc with a pre-rejected Promise cached under the project key, swaps in a handwritten fulfilled generation synchronously after the call starts, and disposes the fixture cache in finally. No native producer runs, and the handwritten generation is not claimed to prove a real capture.
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
