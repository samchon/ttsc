import { assertSnapshotReaderKeepsInputsAcrossConcurrentCompaction } from "../../internal/metro-cache";

/**
 * Verifies a snapshot reader never loses a recorded input while another process
 * compacts the snapshot.
 *
 * A compaction renames each worker file to a claimed name, publishes the merged
 * main file, and only then removes the claimed copy. A reader that listed a
 * worker file just before its rename and then skipped the vanished name would
 * hold the input in neither place it looks, and Metro would reuse a cached
 * transform whose input changed. The reader lists again instead, and reports
 * untrusted state when the directory never settles.
 *
 * 1. Start a second process that records one new input per round and compacts.
 * 2. Read the snapshot state concurrently from this process until it exits.
 * 3. Require each trusted state to retain the inputs counted by the prior progress
 *    observation.
 *
 * @evidence contracts/testing.md#behavioral-verification A real second process alternates createSnapshotRecorder().record of a distinct external path with prepareSnapshot for 150 rounds while this process loops readSnapshotState; any trusted state lacking a path whose progress marker was read before the snapshot read began fails the list of lost rounds. The child must exit 0, the completion marker must report all 150 rounds, and at least one trusted state must be observed.
 * @evidence contracts/testing.md#independent-expectations The expected set follows from the authored progress marker: a round counted by the marker was recorded before the reader started, so its path must be present whichever file it currently lives in; the marker is written by the child, not derived from the reader.
 * @evidence contracts/testing.md#distinguishing-cases Trusted reads must retain the inputs counted by the prior progress observation; undefined is permitted fail-closed state. The interleaving is nondeterministic and the exhausted-retry branch is not reached deliberately. The trusted count can be satisfied by the initial empty snapshot, and no trusted post-exit state containing all 150 inputs is required here, so productive final coverage remains a survivor requirement rather than an assertion of this original.
 * @evidence contracts/testing.md#execution-ownership Actual E2E process boundary: a real second Node process uses the source loader to record and compact while the parent reads persisted state; no native compile, installed consumer or Metro host starts. This original remains discoverable by the source-unit runner during migration, which does not make its execution unit-owned. It is retained until the matching E2E survivor is implemented and actually validated. The original helper joins child exit after a kill but does not separately await child close; a joined close is a survivor requirement.
 */
export const test_snapshot_reader_keeps_inputs_across_concurrent_compaction =
  async () => {
    await assertSnapshotReaderKeepsInputsAcrossConcurrentCompaction();
  };
