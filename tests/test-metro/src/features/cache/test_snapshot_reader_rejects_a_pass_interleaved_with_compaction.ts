import { assertSnapshotReaderRejectsAPassInterleavedWithCompaction } from "../../internal/metro-cache";

/**
 * Verifies the snapshot reader discards a pass that a compaction interleaved
 * with, and reports untrusted state while a lock never clears.
 *
 * A listing taken while a compactor renames entries of the directory is not
 * guaranteed to return each renamed entry once, so a claimed worker file can
 * appear under neither name while its input is not yet in the main file. A
 * compaction holds its lock from the first claim until after the main file is
 * published, so the reader counts a pass only when no lock existed before or
 * after it and the main file read the same on both sides.
 *
 * 1. List no worker file in the first pass and show the lock after it, and assert
 *    the pass is retried and the trusted state holds the recorded input.
 * 2. List none while the main text differs between its reads, and assert the same
 *    retry.
 * 3. Keep the lock present and assert the state is untrusted after eight bounded
 *    attempts without any listing.
 *
 * @evidence contracts/testing.md#behavioral-verification readSnapshotState is called with injected existence, listing and read operations over a real prepared project whose worker file names an external path; a first pass that lists no worker file is discarded when the lock exists after it or the main text changed, the second pass returns a state containing the path, and a lock that always exists yields undefined after exactly eight lock checks and no listing.
 * @evidence contracts/testing.md#independent-expectations The expectation follows from the documented acceptance rule, not from the reader output: the worker file recorded through the real recorder is on disk, so any trusted state lacking its path is wrong, and the listing, main-read and lock-check counts are literals derived from the scripted interleaving.
 * @evidence contracts/testing.md#distinguishing-cases Positive: a settled read and the retried pass of each variant return the input. Negative: a lock after the pass, a changed main text and a permanently held lock each withhold trust for the discarded or unsettled pass. Boundary: the eight-attempt bound. A lock present before a pass is covered by the held-lock variant only.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls readSnapshotState from packages/metro/src/core/fingerprint.ts with the injected SnapshotReadOperations over real temporary files; the interleavings are scripted, no second process or real concurrency runs, and a real race is owned by the concurrent-compaction entry.
 */
export const test_snapshot_reader_rejects_a_pass_interleaved_with_compaction =
  async () => {
    await assertSnapshotReaderRejectsAPassInterleavedWithCompaction();
  };
