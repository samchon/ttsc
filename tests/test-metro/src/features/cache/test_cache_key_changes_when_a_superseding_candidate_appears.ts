import { assertCacheKeyChangesWhenSupersedingCandidateAppears } from "../../internal/metro-cache";

/**
 * Verifies that two Metro runs receive different cache keys when a missing,
 * higher-priority module-resolution candidate appears inside the project walk.
 *
 * The ordinary project walk cannot hash a file that does not exist during the
 * first run. The snapshot recorder must therefore retain the absent candidate
 * until its creation can invalidate the next run.
 *
 * 1. Record a missing in-project candidate during the first snapshot epoch.
 * 2. Compact the worker observation, then create only that candidate.
 * 3. Assert the second run's fingerprint differs from the first one.
 */
export const test_cache_key_changes_when_a_superseding_candidate_appears =
  async () => {
    await assertCacheKeyChangesWhenSupersedingCandidateAppears();
  };
