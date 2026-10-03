import assert from "node:assert/strict";

/** The identity of the generation currently cached under the single key. */
export function cachedGeneration(
  cache: Map<string, Promise<unknown>>,
): unknown {
  assert.equal(cache.size, 1, "one project must own one cache entry");
  return [...cache.values()][0];
}
