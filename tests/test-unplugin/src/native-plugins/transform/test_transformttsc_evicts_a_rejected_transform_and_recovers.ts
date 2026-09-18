import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { primeSuccessfulTransform } from "../../internal/transform-project-cache/primeSuccessfulTransform";

/**
 * Verifies a rejected in-flight generation is surfaced and evicted, so a
 * corrected environment recovers.
 *
 * The cache stores the transform promise before it settles so concurrent
 * callers share one compile. If a rejected generation stayed cached, a
 * transient toolchain or host failure would become permanent for a long-lived
 * Metro or Turbopack worker, replaying the old rejection instead of retrying.
 *
 * 1. Prime a successful transform and replace its generation with a rejected
 *    promise.
 * 2. Deliver and assert the rejection surfaces and nothing stays cached.
 * 3. Deliver again and assert the transform recovers.
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
