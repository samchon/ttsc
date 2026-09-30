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
 * @evidence contracts/testing.md#behavioral-verification Fresh source transformer instances return equal 64-character keys for one unchanged prepared project.
 * @evidence contracts/testing.md#independent-expectations The cache reuse contract requires equality for identical inputs; the controlled upstream removes absence-induced nonces.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged state is the positive reuse control for every changed-input source entry.
 * @evidence contracts/testing.md#execution-ownership This named src/unit/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_cache_key_is_stable_across_runs_for_an_unchanged_project =
  async () => {
    await assertCacheKeyStableAcrossRunsForUnchangedProject();
  };
