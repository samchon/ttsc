import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { primeSuccessfulTransform } from "../../internal/transform-project-cache/primeSuccessfulTransform";

/**
 * Verifies a caller awaiting an old but otherwise matching generation retries
 * when a sibling caller replaces that generation.
 */
export async function test_transformttsc_does_not_serve_a_superseded_matching_generation(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
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
