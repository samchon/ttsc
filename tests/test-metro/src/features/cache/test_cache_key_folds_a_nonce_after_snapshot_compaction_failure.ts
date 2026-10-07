import { assertCacheKeyFoldsNonceAfterSnapshotCompactionFailure } from "../../internal/metro-cache";

/**
 * Verifies a failed main-snapshot rewrite cannot preserve its old stable key.
 *
 * A pending worker document is compacted while the snapshot directory is
 * replaced by a regular file, which fails for every user including root. The
 * recovery document must force nonce keys until a later prepare merges the
 * pending input under a fresh epoch.
 *
 * 1. Prepare a valid main and pending external worker observation.
 * 2. Obstruct the directory and assert a non-reusable token, a recovery record and
 *    nonce keys.
 * 3. Restore it, assert the old epoch and the recovery file alone still nonce,
 *    then verify membership, fresh epoch and stable keys.
 *
 * @evidence contracts/testing.md#behavioral-verification With a worker document naming an external path and the snapshot directory replaced by a regular file, prepareSnapshot returns a nonce:<32 hex> token and leaves exactly one recovery record, two getCacheKey calls differ, and once the directory is restored the main epoch id is unchanged, the recovery record remains and two keys still differ; a further prepareSnapshot gives a new id including the external path, removes worker and recovery files, and makes two keys equal.
 * @evidence contracts/testing.md#independent-expectations The persistence contract is expressed as authored literals: the nonce token pattern and one recovery file during the failure, the same id and key inequality after restoration while only the recovery file marks the state, a changed id and membership of the authored path afterwards, and key equality once healed.
 * @evidence contracts/testing.md#distinguishing-cases Obstructed rewrite versus restored retry are both run in this body, and the unchanged readable main with a recovery file is checked on its own. The obstruction is a regular file where the directory belongs, so it holds for root and on every OS and the body never skips; the failing step is the directory creation that opens compaction, not a later main-file write.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls prepareSnapshot and getCacheKey in-process, using only a regular file placed over the snapshot directory to make it unusable; no native compile, consumer install or Metro host is started.
 */
export const test_cache_key_folds_a_nonce_after_snapshot_compaction_failure =
  async () => {
    await assertCacheKeyFoldsNonceAfterSnapshotCompactionFailure();
  };
