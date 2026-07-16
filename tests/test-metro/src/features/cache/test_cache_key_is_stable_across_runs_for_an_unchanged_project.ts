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
 */
export const test_cache_key_is_stable_across_runs_for_an_unchanged_project =
  async () => {
    await assertCacheKeyStableAcrossRunsForUnchangedProject();
  };
