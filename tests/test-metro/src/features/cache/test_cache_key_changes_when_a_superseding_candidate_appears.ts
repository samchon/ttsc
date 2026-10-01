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
 *
 * @evidence contracts/testing.md#behavioral-verification The recorder persists an absent generated.ts candidate; after compaction, creating that path changes the cache key.
 * @evidence contracts/testing.md#independent-expectations A higher-priority candidate can change resolution before the project walk can hash it; the authored path and key inequality independently pin retention.
 * @evidence contracts/testing.md#distinguishing-cases Absent-to-present candidate crosses membership while neighboring entries exercise ordinary content edits.
 * @evidence contracts/testing.md#execution-ownership This named src/features/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_cache_key_changes_when_a_superseding_candidate_appears =
  async () => {
    await assertCacheKeyChangesWhenSupersedingCandidateAppears();
  };
