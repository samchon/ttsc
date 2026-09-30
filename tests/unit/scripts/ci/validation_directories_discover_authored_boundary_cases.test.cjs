const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { LANES } = require("../../../../scripts/ci/validation-suites.cjs");
const { partitionFiles } = require("../../../../scripts/ci/feature-worker-pool.cjs");

/**
 * Verifies every configured boundary directory discovers authored cases.
 *
 * A migrated directory can remain empty locally while disappearing entirely
 * from a clean checkout. Discovering cases catches both states before a worker
 * starts and prevents one obsolete selector from blocking unrelated cases.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs the actual worker partitioner for every configured suite directory and requires a nonempty selected test population, then compares the merged population with discovery of every directory individually.
 * @evidence contracts/testing.md#independent-expectations Authored test files in each suite are the independent discovery inputs; a required directory with no test entry is invalid even if an empty local folder exists. No expected count is copied from the selector implementation.
 * @evidence contracts/testing.md#distinguishing-cases Exercises each main and Node compatibility directory separately and merged, including nested native plugin populations. Empty or missing directories cannot silently count as coverage, and merged discovery cannot omit or duplicate a filename.
 * @evidence contracts/testing.md#execution-ownership This named CommonJS unit calls the owning filename partitioner against authored repository inputs without importing tests, compiling plugins, or starting product processes. Boundary execution remains in the single E2E batch.
 */
const test_validation_directories_discover_authored_boundary_cases = () => {
  const root = path.resolve(__dirname, "../../../..");
  for (const lane of LANES) {
    const suite = /--filter @ttsc\/(test-[a-z-]+) start/.exec(lane.run)?.[1];
    if (!suite || !lane.dirs) continue;
    const locations = lane.dirs.map((dir) => path.join(root, "tests", suite, "src", dir));
    const expected = new Set();
    for (const location of locations) {
      const names = partitionFiles([location], () => true, 1).flat();
      assert.ok(names.length > 0, `${lane.id}: no authored cases in ${location}`);
      names.forEach((name) => expected.add(name));
    }
    const merged = partitionFiles(locations, () => true, 1).flat();
    assert.equal(new Set(merged).size, merged.length, lane.id);
    assert.deepEqual([...merged].sort(), [...expected].sort(), lane.id);
  }
};

module.exports = { test_validation_directories_discover_authored_boundary_cases };
test("configured boundary directories discover authored cases", test_validation_directories_discover_authored_boundary_cases);
