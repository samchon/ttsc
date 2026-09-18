import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Prime a shared cache with one real successful transform of the default
 * fixture and return the cache API, the single cache key, the resolved good
 * generation value, and the arguments needed to retry the same module.
 *
 * The eviction scenarios below reuse this to plant a failed generation under
 * the exact key `transformTtsc` computes, without depending on the private
 * cache-key encoding.
 */
export async function primeSuccessfulTransform(): Promise<{
  api: {
    createTtscTransformCache: () => Map<string, Promise<unknown>>;
    resolveOptions: (raw?: unknown) => unknown;
    transformTtsc: (
      ...args: unknown[]
    ) => Promise<{ code: string } | undefined>;
  };
  cache: Map<string, Promise<unknown>>;
  key: string;
  good: unknown;
  file: string;
  source: string;
  options: unknown;
}> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject();
  const cache = api.createTtscTransformCache();
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const options = api.resolveOptions();
  const first = await api.transformTtsc(
    file,
    source,
    options,
    undefined,
    cache,
  );
  assert.ok(first, "expected the primed transform to produce output");
  TestUnpluginProject.assertTransformedToPlugin(first.code);
  assert.equal(cache.size, 1);
  const key = [...cache.keys()][0]!;
  const good = await cache.get(key);
  return { api, cache, key, good, file, source, options };
}
