import { assertPrepareSnapshotHealsCorruptWorkerFile } from "../../internal/metro-cache";

/**
 * Verifies compaction heals a corrupt worker snapshot with a new epoch.
 *
 * A torn write from a crashed process leaves an unparseable worker file whose
 * recordings are unrecoverable. Readers must degrade to a per-run nonce while
 * it exists (unknown inputs must never alias a key), and compaction must sweep
 * it and mint a fresh epoch id so later runs stabilize instead of staying
 * nonced forever.
 *
 * 1. Prepare a snapshot; drop an unparseable worker file; assert two runs no
 *    longer share a key.
 * 2. Prepare again: the corrupt file is gone and the epoch id changed.
 * 3. Assert two fresh runs share a stable key again.
 */
export const test_prepare_snapshot_heals_a_corrupt_worker_file_with_a_new_epoch =
  async () => {
    await assertPrepareSnapshotHealsCorruptWorkerFile();
  };
