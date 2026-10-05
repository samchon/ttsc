import assert from "node:assert/strict";

import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies a caller awaiting an old but matching generation retries when a
 * sibling caller replaces it.
 *
 * Concurrent callers share one in-flight generation. A sibling that finds the
 * disk changed evicts it and installs its own compile. The old one may still
 * match this caller's delivery, yet it is no longer the cache's answer, and
 * serving it would return output the cache itself has already discarded.
 *
 * 1. Supply a literal settled-pass generation, and install a pending stale
 *    generation that still matches the source under the same key.
 * 2. Start a matching caller, replace the entry with the literal good generation
 *    as a sibling's recompile would, and resolve the stale generation.
 * 3. Assert the caller returns the replacement's output, not the superseded one.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual authored transformTtsc executes its awaited-generation identity and eviction/retry paths. An otherwise matching stale value with STALE output is replaced during await, so only the newer literal output may be delivered.
 * @evidence contracts/testing.md#independent-expectations Literal good and stale outputs (the stale one containing a STALE marker), the exact replacement Promise identity left in the cache, and a regex check that goUpper is gone specify the concurrent-cache protocol; the fixture's source hash uses Node SHA-256, not the product hash helper. There is no rejection case in this test.
 * @evidence contracts/testing.md#distinguishing-cases A single scenario: a stale generation that still matches the source (it differs only in a STALE output marker) is superseded while the caller awaits it, so the delivery must retry and return the replacement's output. A caller served by the stale generation, or a cache entry replaced again, would fail; other stale-generation variants are not exercised here.
 * @evidence contracts/testing.md#execution-ownership Unit test: drives the real transformTtsc with a handwritten settled-pass generation, a manually resolved pending stale Promise and real temporary config/source files, and disposes the fixture cache in finally. It runs no native producer and does not claim the handwritten generation proves a real capture.
 */
export async function test_transformttsc_does_not_serve_a_superseded_matching_generation(): Promise<void> {
  const fixture = createCachedDeliveryUnitFixture();
  const { api, cache, key, good, file, source, options } = fixture;

  try {
    const goodRecord = good;
    const outputKey = Object.keys(goodRecord.result.typescript)[0]!;
    const staleValue = {
      ...goodRecord,
      result: {
        ...goodRecord.result,
        typescript: {
          ...goodRecord.result.typescript,
          [outputKey]: "export const marker = 'STALE';\n",
        },
      },
    };

    let resolveStale!: (value: TtscCachedProjectTransform) => void;
    const stale = new Promise<TtscCachedProjectTransform>((resolve) => {
      resolveStale = resolve;
    });
    cache.set(key, stale);
    const matching = api.transformTtsc(file, source, options, undefined, cache);
    // A sibling that found the disk changed evicts the pending generation and
    // installs its own compile while this caller still awaits the old one.
    const replacement = Promise.resolve(good);
    cache.set(key, replacement);
    resolveStale(staleValue);

    const matchingResult = await matching;
    assert.ok(matchingResult);
    assert.doesNotMatch(
      matchingResult.code,
      /STALE/,
      "a matching waiter must not return a generation another caller superseded",
    );
    assert.match(matchingResult.code, /PLUGIN/);
    assert.doesNotMatch(matchingResult.code, /goUpper/);
    assert.equal(matchingResult.code, fixture.code);
    assert.equal(cache.get(key), replacement);
  } finally {
    fixture.dispose();
  }
}
