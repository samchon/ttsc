import { assertCacheKeyFoldsNonceAfterSnapshotCompactionFailure } from "../../internal/metro-cache";

/**
 * Verifies a failed main-snapshot rewrite cannot preserve its old stable key.
 *
 * A pending worker document is compacted while the snapshot directory is
 * read-only. The recovery document must force nonce keys until a later prepare
 * merges the pending input under a fresh epoch.
 *
 * 1. Prepare a valid main and pending external worker observation.
 * 2. Deny main writes and assert recovery storage withdraws reusable keys.
 * 3. Restore access and verify membership, fresh epoch and stable keys.
 *
 * @evidence contracts/testing.md#behavioral-verification Denied main compaction retains its old epoch and a recovery record while keys nonce; restored storage merges the external path into a fresh stable epoch.
 * @evidence contracts/testing.md#independent-expectations The persistence contract forbids reuse during an uncommitted observation and requires its membership after recovery; exact epoch relationships provide the oracle.
 * @evidence contracts/testing.md#distinguishing-cases Denied rewrite and successful retry exercise recovery separately from worker publication failure; POSIX non-root permission execution is required.
 * @evidence contracts/testing.md#execution-ownership This named src/features/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_cache_key_folds_a_nonce_after_snapshot_compaction_failure =
  async () => {
    await assertCacheKeyFoldsNonceAfterSnapshotCompactionFailure();
  };
