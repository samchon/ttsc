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
 * @evidence contracts/testing.md#behavioral-verification With a worker document naming an external path and the snapshot directory denied for creation, prepareSnapshot keeps the old main epoch id, leaves exactly one recovery record and makes two getCacheKey calls differ; after access is restored, a further prepareSnapshot gives a new id including the external path, removes worker and recovery files, and makes two keys equal.
 * @evidence contracts/testing.md#independent-expectations The persistence contract is expressed as authored literals: same id and one recovery file during the failure, key inequality while uncommitted, a changed id and membership of the authored path afterwards, and key equality once healed.
 * @evidence contracts/testing.md#distinguishing-cases Denied main rewrite versus restored retry are both run in this body. Denial uses mode bits on POSIX and an Everyone deny entry via icacls on Windows; when the process is root the body logs a SKIPPED notice and asserts nothing.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls prepareSnapshot and getCacheKey in-process, using chmod or icacls only to deny directory writes; no native compile, consumer install or Metro host is started.
 */
export const test_cache_key_folds_a_nonce_after_snapshot_compaction_failure =
  async () => {
    await assertCacheKeyFoldsNonceAfterSnapshotCompactionFailure();
  };
