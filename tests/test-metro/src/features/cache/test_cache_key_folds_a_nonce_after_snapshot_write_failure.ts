import { assertCacheKeyFoldsNonceAfterSnapshotWriteFailure } from "../../internal/metro-cache";

/**
 * Verifies a worker write failure invalidates an older readable snapshot.
 *
 * The controlled POSIX permission boundary keeps the main file readable while
 * rejecting worker files, then permits the sibling recovery document. Keys must
 * nonce until storage recovers, the pending observation is republished, and
 * compaction installs a fresh stable epoch.
 */
export const test_cache_key_folds_a_nonce_after_snapshot_write_failure =
  async () => {
    await assertCacheKeyFoldsNonceAfterSnapshotWriteFailure();
  };
