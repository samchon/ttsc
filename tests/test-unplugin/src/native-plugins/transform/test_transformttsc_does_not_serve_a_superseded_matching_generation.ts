import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { primeSuccessfulTransform } from "../../internal/transform-project-cache/primeSuccessfulTransform";

/**
 * Verifies a caller awaiting an old but matching generation retries when a
 * sibling caller replaces it.
 *
 * Concurrent callers share one in-flight generation. A sibling that finds the
 * disk changed evicts it and installs its own compile. The old one may still
 * match this caller's delivery, yet it is no longer the cache's answer, and
 * serving it would return output the cache itself has already discarded.
 *
 * 1. Prime a successful generation, and install a pending stale generation that
 *    still matches the source under the same key.
 * 2. Start a matching caller, replace the entry with the primed generation as a
 *    sibling's recompile would, and resolve the stale generation.
 * 3. Assert the caller returns the replacement's output, not the superseded one.
 */
export async function test_transformttsc_does_not_serve_a_superseded_matching_generation(): Promise<void> {
  const { api, cache, key, good, file, source, options } =
    await primeSuccessfulTransform();
  const goodRecord = good as {
    result: {
      typescript: Record<string, string>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
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

  let resolveStale!: (value: unknown) => void;
  const stale = new Promise<unknown>((resolve) => {
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
  TestUnpluginProject.assertTransformedToPlugin(matchingResult.code);
  assert.equal(cache.get(key), replacement);
}
