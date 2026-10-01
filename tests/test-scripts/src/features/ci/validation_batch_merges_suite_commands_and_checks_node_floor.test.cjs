const assert = require("node:assert/strict");
const { test } = require("node:test");
const { LANES, nodeFloor, validationSteps } = require("../../../../../scripts/ci/validation-suites.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Calls validationSteps and nodeFloor, checking executor deduplication, retained suite directories, unknown lane rejection and exact semver floor parsing.
 * @evidence contracts/testing.md#independent-expectations Literal first pack command, merged ttsc/lint executor counts and authored >=22.15.0 versus ^22 range establish independent expected behavior.
 * @evidence contracts/testing.md#distinguishing-cases Repeated executor commands must merge rather than run twice, all original directory ownership remains, typo lane and a non-floor semver range reject.
 * @evidence contracts/testing.md#execution-ownership Real planners and range parser run in process; suite commands are returned data, never executed, and no package/file existence is asserted.
 */
const test_validation_batch_merges_suite_commands_and_checks_node_floor = () => {
  const selected = LANES.filter((suite) => !suite.node);
  const steps = validationSteps(selected.map((suite) => suite.id));
  assert.equal(
    steps[0].run,
    "pnpm --dir experimental/test-unplugin start -- --pack-current",
  );
  for (const suite of selected)
    for (const command of suite.run.split(" && ")) {
      const step = steps.find((entry) => entry.run === command);
      assert.ok(step, command);
      for (const dir of suite.dirs ?? []) assert.ok(step.dirs.includes(dir), dir);
    }
  assert.equal(new Set(steps.map((step) => step.run)).size, steps.length);
  assert.equal(validationSteps(["ttsc-core", "ttsc-native"]).length, 1);
  assert.equal(validationSteps(["lint-1", "lint-2"]).length, 1);
  assert.throws(() => validationSteps(["typo"]), /unknown validation lane/);
  assert.equal(nodeFloor({ engines: { node: ">=22.15.0" } }), "22.15.0");
  assert.equal(nodeFloor({ engines: { node: "  >= 24.1.2  " } }), "24.1.2");
  for (const manifest of [{}, { engines: {} }, { engines: { node: ">=22" } }, { engines: { node: 22 } }])
    assert.throws(() => nodeFloor(manifest), /floor/);
  assert.throws(() => nodeFloor({ engines: { node: "^22" } }), /floor/);
};

module.exports = { test_validation_batch_merges_suite_commands_and_checks_node_floor };

test("one validation batch preserves every suite and merges executors", test_validation_batch_merges_suite_commands_and_checks_node_floor);
