import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { primeSuccessfulTransform } from "../../internal/transform-project-cache/primeSuccessfulTransform";

/**
 * Verifies a rejected in-flight transform generation is surfaced to the caller
 * and evicted, so a corrected environment recovers.
 *
 * The cache stores the transform Promise before it settles so concurrent
 * callers share one compile. If a rejected generation stayed cached, a
 * transient toolchain/host failure would become permanent for a long-lived
 * Metro or Turbopack worker: every later request for the unchanged module would
 * replay the old rejection instead of retrying. Replacing the primed success
 * with a rejected Promise reproduces the `await transformed` branch exactly.
 */
export async function test_transformttsc_evicts_a_rejected_transform_and_recovers(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { api, cache, key, file, source, options } =
    await primeSuccessfulTransform();

  const rejected = Promise.reject(new Error("transient host failure"));
  rejected.catch(() => undefined); // suppress the unhandled-rejection warning
  cache.set(key, rejected);

  await assert.rejects(
    () => api.transformTtsc(file, source, options, undefined, cache),
    /transient host failure/,
  );
  assert.equal(cache.size, 0, "rejected generation must not stay cached");

  const recovered = await api.transformTtsc(
    file,
    source,
    options,
    undefined,
    cache,
  );
  assert.ok(recovered, "corrected retry must re-run the transform");
  TestUnpluginProject.assertTransformedToPlugin(recovered.code);
  assert.equal(cache.size, 1);
}
