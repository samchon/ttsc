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
 * 1. Prepare a snapshot, then drop a tainted worker file.
 * 2. Prepare again while removing a claimed file fails, and note the epoch.
 * 3. Prepare once more, and assert the epoch is kept and the leftover is gone.
 */
export const test_prepare_snapshot_does_not_merge_a_leftover_claimed_file_again =
  async () => {
    await assertCompactionDoesNotMergeALeftoverClaimedFileAgain();
  };
