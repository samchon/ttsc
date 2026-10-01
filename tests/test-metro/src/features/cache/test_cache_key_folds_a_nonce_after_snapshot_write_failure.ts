import { assertCacheKeyFoldsNonceAfterSnapshotWriteFailure } from "../../internal/metro-cache";

/**
 * Verifies a worker write failure invalidates an older readable snapshot.
 *
 * The controlled POSIX permission boundary keeps the main file readable while
 * rejecting worker files, then permits the sibling recovery document. Keys must
 * nonce until storage recovers, the pending observation is republished, and
 * compaction installs a fresh stable epoch.
 *
 * 1. Prepare a main snapshot and external recorder input.
 * 2. Deny worker writes while leaving sibling recovery storage available.
 * 3. Restore access, retry publication and verify fresh stable compaction.
 *
 * @evidence contracts/testing.md#behavioral-verification A denied worker write leaves a durable recovery record and nonreusable keys; restoring access republishes the retained observation, rotates the epoch and restores stable keys.
 * @evidence contracts/testing.md#independent-expectations Fail-closed persistence and recovered reuse independently require inequality before recovery, membership of the authored external path and equality afterwards.
 * @evidence contracts/testing.md#distinguishing-cases Readable main state with denied worker writes contrasts restored storage; POSIX permission assertions execute only on non-root POSIX hosts, not Windows.
 * @evidence contracts/testing.md#execution-ownership This named src/features/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_cache_key_folds_a_nonce_after_snapshot_write_failure =
  async () => {
    await assertCacheKeyFoldsNonceAfterSnapshotWriteFailure();
  };
