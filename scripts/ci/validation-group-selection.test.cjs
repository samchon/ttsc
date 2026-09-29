const assert = require("node:assert/strict");
const { test } = require("node:test");
const { LANES, NODE_FLOOR, nodeFloor, validationSteps } = require("./validation-suites.cjs");

test("one validation batch preserves every suite and merges executors", () => {
  const selected = LANES.filter((suite) => !suite.node);
  const steps = validationSteps(selected.map((suite) => suite.id));
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
  assert.ok(NODE_FLOOR);
  assert.throws(() => nodeFloor({ engines: { node: "^22" } }), /floor/);
});
