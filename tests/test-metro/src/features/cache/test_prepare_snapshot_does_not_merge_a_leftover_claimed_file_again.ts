import { assertCompactionDoesNotMergeALeftoverClaimedFileAgain } from "../../internal/metro-cache";

/**
 * Verifies a compaction does not merge again a claimed worker file an earlier
 * compaction merged but could not remove.
 *
 * A compaction claims each worker file by renaming it, merges it into the main
 * snapshot, and then removes it, accepting a removal that fails. On Windows a
 * process holding the file makes it fail, and the next compaction read the
 * leftover as a new observation: a tainted one rotated the snapshot epoch
 * again, disabling Metro's cache reuse until the file could be removed. The
 * main snapshot now names the claimed files it holds.
 *
 * 1. Prepare a snapshot, then write a valid committed main/claimed-worker pair.
 * 2. Read the retained tainted claim and assert its published epoch is unchanged.
 * 3. Prepare once more, and assert the epoch is kept and the leftover is gone.
 *
 * @evidence contracts/testing.md#behavioral-verification readSnapshotState ignores a tainted claimed worker already listed in the committed main snapshot; subsequent preparation preserves the epoch and removes that residue.
 * @evidence contracts/testing.md#independent-expectations Publication-before-unlink records which claims have already been applied; equality of the observed epoch and false taint independently distinguish replay.
 * @evidence contracts/testing.md#distinguishing-cases A retained tainted claim contrasts new uncommitted observations. The fixture represents post-commit residue and does not certify an actual OS unlink denial.
 * @evidence contracts/testing.md#execution-ownership This named src/features/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_prepare_snapshot_does_not_merge_a_leftover_claimed_file_again =
  async () => {
    await assertCompactionDoesNotMergeALeftoverClaimedFileAgain();
  };
