import { assertCacheKeyFoldsNonceAfterSnapshotWriteFailure } from "../../internal/metro-cache";

/**
 * Verifies a worker write failure invalidates an older readable snapshot.
 *
 * A regular file placed over the snapshot directory rejects the worker file
 * while the sibling recovery document is still writable; once the directory is
 * back, the old main file is readable again beside that recovery document. Keys must
 * nonce until storage recovers, the pending observation is republished, and
 * compaction installs a fresh stable epoch.
 *
 * 1. Prepare a main snapshot and external recorder input.
 * 2. Obstruct the snapshot directory and assert one recovery record and nonce keys.
 * 3. Restore it and assert the recovery file alone still nonces, then retry
 *    publication and verify fresh stable compaction.
 *
 * @evidence contracts/testing.md#behavioral-verification With the snapshot directory replaced by a regular file, a recorder's record of an external .d.ts leaves exactly one recovery record and non-equal keys; after restoring the directory there is still no worker file, the main id is unchanged, one recovery record remains and two keys still differ; the retried record republishes [external], prepareSnapshot rotates the epoch id, includes the path, clears worker and recovery files, and two later keys are equal and differ from the original key.
 * @evidence contracts/testing.md#independent-expectations Authored literals define the expectations: one recovery file during the obstruction, no worker snapshots, the unchanged main id and inequality of two keys after restoration, then the external path in the worker union, a changed id and key equality afterwards.
 * @evidence contracts/testing.md#distinguishing-cases Denied worker write and restored retry are both exercised against the same readable main snapshot. The obstruction is a regular file where the directory belongs, so it holds for root and on every OS and the body never skips.
 * @evidence contracts/testing.md#execution-ownership Unit layer: drives createSnapshotRecorder, prepareSnapshot and getCacheKey in-process, using only a regular file placed over the snapshot directory to make it unusable; no native compile, consumer install or Metro host.
 */
export const test_cache_key_folds_a_nonce_after_snapshot_write_failure =
  async () => {
    await assertCacheKeyFoldsNonceAfterSnapshotWriteFailure();
  };
