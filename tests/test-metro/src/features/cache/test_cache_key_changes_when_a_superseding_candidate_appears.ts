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
 * @evidence contracts/testing.md#behavioral-verification A recorder records the absent in-project path src/generated.ts, the worker snapshot files equal exactly [that path], and after compaction writing that file makes getCacheKey differ from the key computed before it existed.
 * @evidence contracts/testing.md#independent-expectations The authored candidate path is compared literally against the persisted worker file list, and the later key must differ. Oracle limit: src is inside the include root, so the project walk alone also re-keys when the file appears; only the literal worker-file assertion proves the recorder retained the absent path.
 * @evidence contracts/testing.md#distinguishing-cases One absent-to-present transition of a single path is exercised; no unchanged-key control or content-edit case is in this body (those belong to the stable and project-source-change tests).
 * @evidence contracts/testing.md#execution-ownership Unit layer: drives createSnapshotRecorder, resolveProjectView, prepareSnapshot and the transformer's getCacheKey in-process on a temp project; no native compile, consumer install or Metro host is involved.
 */
export const test_cache_key_changes_when_a_superseding_candidate_appears =
  async () => {
    await assertCacheKeyChangesWhenSupersedingCandidateAppears();
  };
