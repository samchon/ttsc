import { assertPrepareSnapshotCompactsWorkerFiles } from "../../../internal/metro/internal/metro-cache";

/**
 * Verifies snapshot compaction merges worker files into the main snapshot.
 *
 * Workers write uniquely named files to stay race-free; `withTtsc` compacts
 * them at the next config load. The files union must survive, the epoch id must
 * be preserved (compaction is maintenance, not an epoch change that would
 * spuriously invalidate every cache entry), and the worker files must be gone
 * afterwards.
 *
 * 1. Prepare a snapshot; note its id; drop a worker file recording a path.
 * 2. Prepare again.
 * 3. Assert the main snapshot keeps the id, contains the path, and no worker files
 *    remain.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual preparation rejects live lock ownership, recovers a proven-dead Node child lock and then compacts a valid worker into the unchanged main epoch with cleanup.
 * @evidence contracts/testing.md#independent-expectations The live current PID and actually exited child establish independent ownership facts; literal private-token grammar, retained worker and epoch equality require conservative recovery.
 * @evidence contracts/testing.md#distinguishing-cases Live owner contrasts proven-dead owner, followed by a new preparation that merges the retained valid worker.
 * @evidence contracts/testing.md#execution-ownership This named features export test_prepare_snapshot_compacts_worker_files_into_the_main_snapshot executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary Real process liveness determines lock recovery; a synthetic PID value cannot establish an owner has actually terminated.
 * @evidence contracts/e2e.md#shared-execution One trivial Node child supplies the dead-owner witness; all contention, recovery and merge observations share one prepared directory and start no native compiler or consumer installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The live lock is removed in finally and the dead child is synchronous/completed. Worker/main/retired-lock resources remain below one tracked project cleaned by the test process.
 * @evidence contracts/e2e.md#preserved-coverage Live-contender nonce/no-rewrite, dead-owner nonce/retirement marker, worker retention and final epoch/membership/removal assertions all remain.
 */
export const test_prepare_snapshot_compacts_worker_files_into_the_main_snapshot =
  async () => {
    await assertPrepareSnapshotCompactsWorkerFiles();
  };
