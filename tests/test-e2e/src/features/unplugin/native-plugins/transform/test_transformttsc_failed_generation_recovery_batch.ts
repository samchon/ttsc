import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { primeSuccessfulTransform } from "../../../../internal/unplugin/internal/transform-project-cache/primeSuccessfulTransform";

/**
 * Verifies rejected and exceptional generations recover through one native
 * project.
 *
 * Rejection and a resolved host exception reach different adapter failure
 * owners. Both must evict the failed generation and permit a real subsequent
 * capture; a cached exception is never replayed (samchon/ttsc#1400), so its
 * delivery recompiles instead of failing. The first recovery's real successful
 * generation supplies the second phase rather than compiling another seed.
 *
 * 1. Capture and verify one native successful checkpoint.
 * 2. Exercise rejected-Promise eviction and actual successful retry.
 * 3. Exercise resolved-exception eviction without replay and actual successful
 *    retry.
 * 4. Collect both phase failures and dispose the cache on every exit.
 *
 * @evidence contracts/testing.md#behavioral-verification The built public transformTtsc traverses both failed-Promise and resolved-exception eviction paths, then actually captures recovered plugin output twice; the cached exception is replaced without delivering a failure.
 * @evidence contracts/testing.md#independent-expectations Literal failure messages, zero/one cache sizes, the replaced planted generation, no failure batch and PLUGIN/no-goUpper assertions define the recovery expectations.
 * @evidence contracts/testing.md#distinguishing-cases A rejected Promise, replayed to its waiter, contrasts with a fulfilled exception envelope, which is not replayed; both require successful retry. Exception watch registration is owned by the source unit test_failed_exception_generation_watches_aliases_but_not_scratch_or_message_paths.
 * @evidence contracts/testing.md#execution-ownership The single named native batch owns every assertion formerly in the two recovery entries. Its two independently reported phases execute through the real public API and Go fixture; the three Promise-authority scenarios now execute as direct source units.
 * @evidence contracts/e2e.md#necessary-boundary Actual recovery must connect an evicted failed generation to a fresh native plugin result rather than a handwritten successful response. Both failure channels are exercised through the public API.
 * @evidence contracts/e2e.md#shared-execution One root, options, producer artifact and cache serve both failure phases. One initial native prime is shared, the first successful recovery becomes the second phase's checkpoint, and the two subsequent captures remain necessary to prove recovery.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Source, options and native producer inputs stay unchanged; each phase overwrites the cache with its own failed Promise/envelope. Only a fully asserted recovery replaces the checkpoint; on a phase assertion failure the original actual checkpoint remains available to the next phase. The delivery cache and an ownership ledger of actual generations are reset in finally, releasing checkpoints overwritten by planted failures as well as the final cached result.
 * @evidence contracts/e2e.md#preserved-coverage All original rejection, recovered-output and cache-size assertions remain; the exception phase's alias, scratch and message-path watch assertions moved to the source unit with the owner they exercise, since #1400 never delivers a cached exception; individual phase failures are collected before throwing so the second independent case still runs. Prime success/output/cache-size checks remain once at the common actual producer boundary.
 */
export async function test_transformttsc_failed_generation_recovery_batch(): Promise<void> {
  const {
    api,
    cache,
    key,
    good: initialGood,
    file,
    source,
    options,
  } = await primeSuccessfulTransform();
  let checkpoint = initialGood;
  // Replacing an entry with a planted failure must not orphan its native handles.
  const ownedGenerations = new Map<string, Promise<unknown>>([
    ["initial", Promise.resolve(initialGood)],
  ]);
  const failures: Error[] = [];
  const phase = async (
    label: string,
    run: () => Promise<void>,
  ): Promise<void> => {
    try {
      await run();
    } catch (error) {
      failures.push(new Error(label, { cause: error }));
    }
  };
  try {
    await phase("rejected-generation recovery", async () => {
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
      const recoveredGeneration = cache.get(key);
      if (recoveredGeneration !== undefined) {
        ownedGenerations.set("recovery-1", recoveredGeneration);
      }
      assert.ok(recovered, "corrected retry must re-run the transform");
      TestUnpluginProject.assertTransformedToPlugin(recovered.code);
      assert.equal(cache.size, 1);
      checkpoint = await cache.get(key);
    });
    await phase("exception-generation recovery", async () => {
      // A host exception is an answer about one attempt, delivered by the
      // compile that produced it; a cached one is never replayed
      // (samchon/ttsc#1400), so the next delivery recompiles. Its failure
      // watches belong to notifyFailedGenerationInputs, whose source unit
      // test_failed_exception_generation_watches_aliases_but_not_scratch_or_message_paths
      // keeps the alias, scratch and message-path assertions.
      const planted = Promise.resolve({
        ...(checkpoint as Record<string, unknown>),
        result: {
          type: "exception",
          error: new Error("host exploded"),
        },
      });
      cache.set(key, planted);
      let failureBatches = 0;

      const recovered = await api.transformTtsc(
        file,
        source,
        options,
        undefined,
        cache,
        {
          addWatchFiles(
            _inputs: readonly { file: string }[],
            failure?: boolean,
          ) {
            if (failure === true) ++failureBatches;
          },
        },
      );
      const recoveredGeneration = cache.get(key);
      if (recoveredGeneration !== undefined) {
        ownedGenerations.set("recovery-2", recoveredGeneration);
      }
      assert.ok(recovered, "a cached exception must be compiled again");
      TestUnpluginProject.assertTransformedToPlugin(recovered.code);
      assert.equal(cache.size, 1);
      assert.notEqual(
        recoveredGeneration,
        planted,
        "the cached exception generation must be replaced",
      );
      assert.equal(failureBatches, 0, "no failure was delivered");
    });
    if (failures.length !== 0) {
      throw new AggregateError(failures, "Native recovery batch failed");
    }
  } finally {
    try {
      api.resetTtscTransformCache(cache);
    } finally {
      api.resetTtscTransformCache(ownedGenerations);
    }
  }
}
