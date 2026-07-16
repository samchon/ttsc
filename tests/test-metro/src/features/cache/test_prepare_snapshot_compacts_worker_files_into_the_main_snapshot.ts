import { assertPrepareSnapshotCompactsWorkerFiles } from "../../internal/metro-cache";

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
 */
export const test_prepare_snapshot_compacts_worker_files_into_the_main_snapshot =
  async () => {
    await assertPrepareSnapshotCompactsWorkerFiles();
  };
