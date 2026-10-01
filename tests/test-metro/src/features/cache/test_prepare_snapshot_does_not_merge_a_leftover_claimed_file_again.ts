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
 * @evidence contracts/testing.md#behavioral-verification With the main snapshot naming graph-inputs.worker-claimed-retained.json as compacted and that tainted worker file left on disk, readSnapshotState returns the same epoch id with tainted false, and the next prepareSnapshot keeps the id and removes the leftover file.
 * @evidence contracts/testing.md#independent-expectations Expected values follow from the authored fixture: an unchanged id, tainted false and an empty worker list after compaction, distinguishing replay of the tainted claim from ignoring it.
 * @evidence contracts/testing.md#distinguishing-cases The listed-as-compacted tainted claim is the only case; no new uncommitted observation is created. The fixture models post-commit residue and does not exercise a real OS unlink denial.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls readSnapshotState and prepareSnapshot in-process over files written by fs; no transformer, native compile, consumer install or Metro host.
 */
export const test_prepare_snapshot_does_not_merge_a_leftover_claimed_file_again =
  async () => {
    await assertCompactionDoesNotMergeALeftoverClaimedFileAgain();
  };
