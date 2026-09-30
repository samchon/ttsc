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
 *
 * @evidence contracts/testing.md#behavioral-verification Malformed worker, main and recovery documents independently withdraw key reuse, are swept or replaced under a new epoch, then permit stable keys.
 * @evidence contracts/testing.md#independent-expectations Each schema4 document changes one authored invariant; exact nonce inequality, epoch changes, removals and healed equality come from fail-closed snapshot behavior.
 * @evidence contracts/testing.md#distinguishing-cases Torn JSON, bad field types, identity, legacy version, relative or duplicated/unsorted paths, invalid trees and foreign fields retain separate named scenarios plus main/recovery parser paths.
 * @evidence contracts/testing.md#execution-ownership This named src/unit/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_prepare_snapshot_heals_a_corrupt_worker_file_with_a_new_epoch =
  async () => {
    await assertPrepareSnapshotHealsCorruptWorkerFile();
  };
