import { assertSnapshotReaderKeepsInputsAcrossConcurrentCompaction } from "../../internal/metro-cache";

/**
 * Verifies a snapshot reader never loses a recorded input while another
 * process compacts the snapshot.
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
 * 3. Require each trusted state to hold every input recorded before its read.
 *
 * @evidence contracts/testing.md#behavioral-verification A real second process alternates createSnapshotRecorder().record of a distinct external path with prepareSnapshot for 150 rounds while this process loops readSnapshotState; any trusted state lacking a path whose round had finished before the read began fails the list of lost rounds, the child must exit 0 and at least one trusted state must be observed. Skipping a vanished name instead of listing again made this loop lose inputs in 43 of about 5000 reads when tried against the reader.
 * @evidence contracts/testing.md#independent-expectations The expected set follows from the authored progress marker: a round counted by the marker was recorded before the reader started, so its path must be present whichever file it currently lives in; the marker is written by the child, not derived from the reader.
 * @evidence contracts/testing.md#distinguishing-cases The positive case is a trusted state with every completed round present; undefined states are the permitted fail-closed outcome and are not counted as passes. The interleaving is real and nondeterministic, so a defect is detected with high probability rather than by construction; the exhausted-retry branch is not reached deliberately.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls readSnapshotState, createSnapshotRecorder and prepareSnapshot from source, the second process only runs these same functions under the unit loader; no native compile, consumer install or Metro host.
 */
export const test_snapshot_reader_keeps_inputs_across_concurrent_compaction =
  async () => {
    await assertSnapshotReaderKeepsInputsAcrossConcurrentCompaction();
  };
