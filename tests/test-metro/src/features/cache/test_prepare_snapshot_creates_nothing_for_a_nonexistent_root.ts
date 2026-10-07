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
 *
 * @evidence contracts/testing.md#behavioral-verification prepareSnapshot called with a path whose parent exists but which does not exist itself returns without creating that path.
 * @evidence contracts/testing.md#independent-expectations The contract that preparation must not create directory trees for a missing project root is checked as a literal fs.existsSync(path) === false.
 * @evidence contracts/testing.md#distinguishing-cases Only the nonexistent-root negative boundary is run here; successful preparation on an existing root is covered by the other cache entries.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls fingerprint.prepareSnapshot in-process on a temp path and checks the filesystem; no native compile, consumer install, transformer or Metro host.
 */
export const test_prepare_snapshot_creates_nothing_for_a_nonexistent_root =
  async () => {
    await assertPrepareSnapshotSkipsNonexistentRoot();
  };
