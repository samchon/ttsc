import { assertPrepareSnapshotSkipsNonexistentRoot } from "../../internal/metro-cache";

/**
 * Verifies snapshot preparation creates nothing for a nonexistent project root.
 *
 * Metro verifies the project root exists before running, so a nonexistent base
 * can never be a working setup; `withTtsc` recursively creating
 * `node_modules/.cache/ttsc-metro` there would materialize directory trees at
 * arbitrary filesystem paths as a config-load side effect.
 *
 * 1. Point snapshot preparation at a path that does not exist.
 * 2. Assert the path still does not exist afterwards.
 */
export const test_prepare_snapshot_creates_nothing_for_a_nonexistent_root =
  async () => {
    await assertPrepareSnapshotSkipsNonexistentRoot();
  };
