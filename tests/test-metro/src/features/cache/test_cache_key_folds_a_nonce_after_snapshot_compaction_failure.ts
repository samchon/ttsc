import { assertCacheKeyFoldsNonceAfterSnapshotCompactionFailure } from "../../internal/metro-cache";

/**
 * Verifies a failed main-snapshot rewrite cannot preserve its old stable key.
 *
 * A pending worker document is compacted while the snapshot directory is
 * read-only. The recovery document must force nonce keys until a later prepare
 * merges the pending input under a fresh epoch.
 */
export const test_cache_key_folds_a_nonce_after_snapshot_compaction_failure =
  async () => {
    await assertCacheKeyFoldsNonceAfterSnapshotCompactionFailure();
  };
