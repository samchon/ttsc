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
 * 1. For each of eighteen malformed worker documents, prepare a snapshot, drop
 *    the file and assert two runs no longer share a key.
 * 2. Prepare again: the file is gone and the epoch id changed.
 * 3. Assert two fresh runs share a stable key again, then repeat the same
 *    sequence for a malformed main snapshot and a malformed recovery document.
 *
 * @evidence contracts/testing.md#behavioral-verification For eighteen malformed worker documents, then a malformed main snapshot and a malformed recovery document, two getCacheKey calls differ; prepareSnapshot then removes the worker or recovery file (or rewrites the main), changes the epoch id, and two later keys are equal.
 * @evidence contracts/testing.md#independent-expectations Each worker row is an authored document breaking one field or ordering rule (torn JSON and the legacy version row differ from the others in kind), and the expectations are literal nonce inequality, epoch change, file removal and healed equality.
 * @evidence contracts/testing.md#distinguishing-cases Separate scenarios cover torn JSON, non-string file, non-boolean taint and volatility, invalid id, legacy version, relative path, duplicate and unsorted files, tree outside files, non-string and unsorted trees, a foreign field, accessible entries outside files, non-string, duplicate and unsorted entries, and a compacted name escaping the directory, plus the main-document and recovery-document parser paths.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls prepareSnapshot and getCacheKey from fresh transformer modules in-process, writing malformed documents with fs; no native compile, consumer install or Metro host.
 */
export const test_prepare_snapshot_heals_a_corrupt_worker_file_with_a_new_epoch =
  async () => {
    await assertPrepareSnapshotHealsCorruptWorkerFile();
  };
