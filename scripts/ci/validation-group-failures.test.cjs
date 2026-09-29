const assert = require("node:assert/strict");
const { test } = require("node:test");
const { runAll } = require("./run-validation-group.cjs");

test("a shared runner reports every failed command and still runs later suites", async () => {
  const steps = ["first", "second", "last"].map((run) => ({ run, dirs: [] }));
  const called = [];
  assert.deepEqual(await runAll(steps, (step) => {
    called.push(step.run);
    return step.run === "second" ? 0 : 1;
  }), ["first", "last"]);
  assert.deepEqual(called, ["first", "second", "last"]);
});
