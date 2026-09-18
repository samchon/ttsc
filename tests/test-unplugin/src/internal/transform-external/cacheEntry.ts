import assert from "node:assert/strict";

/** The single cached generation object, for cache-identity assertions. */
export function cacheEntry(cache: Map<string, unknown>): unknown {
  assert.equal(cache.size, 1);
  return [...cache.values()][0];
}
