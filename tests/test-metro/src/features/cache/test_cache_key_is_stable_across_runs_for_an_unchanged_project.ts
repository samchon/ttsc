import { assertCacheKeyStableAcrossRunsForUnchangedProject } from "../../internal/metro-cache";

/**
 * Verifies the cache key stays stable across runs of an unchanged project.
 *
 * The negative twin of every fingerprint invalidation case: the project
 * fingerprint (samchon/ttsc#721) must re-key runs only when an input actually
 * changed, or Metro's persistent cache would never be reused and the mechanism
 * would degrade to a permanent `--reset-cache`.
 *
 * 1. Create a plugin-less project and prepare the snapshot (as `withTtsc` does).
 * 2. Compute `getCacheKey` in two fresh transformer modules (two runs).
 * 3. Assert both keys are equal 64-char digests.
 *
 * @evidence contracts/testing.md#behavioral-verification After prepareSnapshot on an unmodified project, two getCacheKey calls from fresh transformer modules return the same value, and that value is 64 characters long.
 * @evidence contracts/testing.md#independent-expectations Equality for identical inputs is the cache-reuse contract; supplying a fake upstream with a getCacheKey avoids the nonce a missing upstream would add.
 * @evidence contracts/testing.md#distinguishing-cases This body is the positive equality control only; the changed-input and nonce cases live in other entries.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls prepareSnapshot and getCacheKey in-process over a temp project with a fake upstream; no native compile, consumer install or Metro host.
 */
export const test_cache_key_is_stable_across_runs_for_an_unchanged_project =
  async () => {
    await assertCacheKeyStableAcrossRunsForUnchangedProject();
  };
