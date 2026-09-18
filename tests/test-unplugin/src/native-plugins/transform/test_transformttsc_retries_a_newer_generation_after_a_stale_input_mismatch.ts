import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { primeSuccessfulTransform } from "../../internal/transform-project-cache/primeSuccessfulTransform";

/**
 * Verifies a stale input-mismatch cleanup neither deletes nor bypasses a newer
 * generation installed while the stale Promise was pending.
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
