import assert from "node:assert/strict";

import { primeSuccessfulTransform } from "../../internal/transform-project-cache/primeSuccessfulTransform";

/**
 * Verifies a caller awaiting an old but matching generation retries when a
 * sibling caller replaces it.
 *
 * Concurrent callers share one in-flight generation. If a sibling replaced it
 * while this caller was waiting, the old one may still match this caller's
 * source, yet it is no longer the cache's answer, and serving it would return
 * output the cache itself has already discarded.
 *
 * 1. Prime a successful generation, and install a stale but matching one under the
 *    same key.
 * 2. Start a delivery, then let a mismatching caller replace the generation while
 *    it waits.
 * 3. Assert the waiting delivery does not return the superseded output.
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
  const mismatching = api.transformTtsc(
    file,
    `${source}\n// mismatching caller\n`,
    options,
    undefined,
    cache,
  );
  const matching = api.transformTtsc(file, source, options, undefined, cache);
  resolveStale(staleValue);

  const matchingResult = await matching;
  assert.ok(matchingResult);
  assert.doesNotMatch(
    matchingResult.code,
    /STALE/,
    "a matching waiter must not return a generation another caller superseded",
  );
  assert.ok(await mismatching);
  assert.notEqual(cache.get(key), stale);
}
