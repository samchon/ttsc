import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { primeSuccessfulTransform } from "../../internal/transform-project-cache/primeSuccessfulTransform";

/**
 * Verifies a failed generation's cleanup cannot remove a newer generation
 * another caller installed under the same key.
 *
 * Eviction is identity-guarded: it deletes the entry only when the cache still
 * holds the exact failed generation. This pins that guard by replacing the
 * failed generation with a fresh one after the failing call has begun awaiting
 * but before its rejection eviction runs; the newer generation must survive.
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
