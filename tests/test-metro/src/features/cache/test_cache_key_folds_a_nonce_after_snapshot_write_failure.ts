import { assertCacheKeyFoldsNonceAfterSnapshotWriteFailure } from "../../internal/metro-cache";

/**
 * Verifies a worker write failure invalidates an older readable snapshot.
 *
 * A controlled permission boundary (mode bits on POSIX, an Everyone deny entry on Windows) keeps the main file readable while
 * rejecting worker files, then permits the sibling recovery document. Keys must
 * nonce until storage recovers, the pending observation is republished, and
 * compaction installs a fresh stable epoch.
 *
 * 1. Prepare a main snapshot and external recorder input.
 * 2. Deny worker writes while leaving sibling recovery storage available.
 * 3. Restore access, retry publication and verify fresh stable compaction.
 *
 * @evidence contracts/testing.md#behavioral-verification With the snapshot directory denied for creation, a recorder's record of an external .d.ts leaves no worker file, exactly one recovery record and non-equal keys; after restoring access the retried record republishes [external], prepareSnapshot rotates the epoch id, includes the path, clears worker and recovery files, and two later keys are equal and differ from the original key.
 * @evidence contracts/testing.md#independent-expectations Authored literals define the expectations: no worker snapshots and one recovery file during the denial, inequality of two keys, then the external path in the worker union, a changed id and key equality afterwards.
 * @evidence contracts/testing.md#distinguishing-cases Denied worker write and restored retry are both exercised against the same readable main snapshot. Denial uses mode bits on POSIX and an Everyone deny entry via icacls on Windows; when the process is root the body logs a SKIPPED notice and asserts nothing.
 * @evidence contracts/testing.md#execution-ownership Unit layer: drives createSnapshotRecorder, prepareSnapshot and getCacheKey in-process, using chmod or icacls only to deny directory writes; no native compile, consumer install or Metro host.
 */
export const test_cache_key_folds_a_nonce_after_snapshot_write_failure =
  async () => {
    await assertCacheKeyFoldsNonceAfterSnapshotWriteFailure();
  };
