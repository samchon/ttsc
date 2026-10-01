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
 * @evidence contracts/testing.md#behavioral-verification prepareSnapshot on a nonexistent project path leaves that path absent.
 * @evidence contracts/testing.md#independent-expectations The operation requires an existing project; creating a directory for an invalid input would be an observable side effect.
 * @evidence contracts/testing.md#distinguishing-cases Nonexistent root is the negative boundary for successful preparation, not a committed-file presence check.
 * @evidence contracts/testing.md#execution-ownership This named src/features/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_prepare_snapshot_creates_nothing_for_a_nonexistent_root =
  async () => {
    await assertPrepareSnapshotSkipsNonexistentRoot();
  };
