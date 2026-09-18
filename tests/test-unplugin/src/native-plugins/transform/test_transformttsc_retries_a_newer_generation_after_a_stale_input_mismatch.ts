import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { primeSuccessfulTransform } from "../../internal/transform-project-cache/primeSuccessfulTransform";

/**
 * Verifies a stale generation's input mismatch neither deletes nor bypasses a
 * newer generation installed meanwhile.
 *
 * A caller waiting on a stale generation finds its inputs mismatched when it
 * resolves. By then a sibling may have installed a newer generation under the
 * same key, and the right answer is to retry against that one, not evict it or
 * recompile past it.
 *
 * 1. Prime a successful transform, and install a pending stale generation under
 *    its key.
 * 2. Start a delivery, install a newer generation, then resolve the stale one with
 *    mismatching hashes.
 * 3. Assert the delivery is transformed and the newer generation remains cached.
 */
export async function test_transformttsc_retries_a_newer_generation_after_a_stale_input_mismatch(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { api, cache, key, good, file, source, options } =
    await primeSuccessfulTransform();

  let resolveStale!: (value: unknown) => void;
  const stale = new Promise<unknown>((resolve) => {
    resolveStale = resolve;
  });
  cache.set(key, stale);
  const pending = api.transformTtsc(file, source, options, undefined, cache);

  const newer = Promise.resolve(good);
  cache.set(key, newer);
  resolveStale({
    ...(good as Record<string, unknown>),
    inputHashes: {},
  });

  const result = await pending;
  assert.ok(result);
  TestUnpluginProject.assertTransformedToPlugin(result.code);
  assert.equal(
    cache.get(key),
    newer,
    "a stale mismatch must retry the authoritative newer generation",
  );
}
