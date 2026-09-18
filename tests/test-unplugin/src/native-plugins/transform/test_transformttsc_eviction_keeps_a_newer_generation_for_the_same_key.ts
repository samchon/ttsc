import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { primeSuccessfulTransform } from "../../internal/transform-project-cache/primeSuccessfulTransform";

/**
 * Verifies a failed generation's cleanup cannot remove a newer generation
 * installed under the same key.
 *
 * Eviction is identity-guarded: it deletes the entry only while the cache still
 * holds the exact failed generation. Replacing the failed generation after the
 * failing call began waiting, but before its eviction ran, pins that guard.
 *
 * 1. Prime a successful transform and install a rejected generation under its key.
 * 2. Start a delivery, then install a newer generation under the same key.
 * 3. Assert the delivery rejects and the newer generation survives.
 */
export async function test_transformttsc_eviction_keeps_a_newer_generation_for_the_same_key(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { api, cache, key, good, file, source, options } =
    await primeSuccessfulTransform();

  const stale = Promise.reject(new Error("stale generation"));
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
}
