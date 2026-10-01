const assert = require("node:assert/strict");
const { test } = require("node:test");
const { runAll } = require("../../../../../scripts/ci/run-validation-group.cjs");

/**
 * Verifies validation continues after failure and reports every failed command.
 *
 * One failed suite must not hide the result of later independent suites.
 *
 * 1. Fail the first and last callbacks around a successful command.
 * 2. Assert complete invocation and the exact ordered failure list.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the validation runner's runAll and observes callback execution and returned failures, detecting early termination or lost failure identities.
 * @evidence contracts/testing.md#independent-expectations The injected callback explicitly returns success only for second; the expected first and last failures and input invocation order are authored independently of runner output.
 * @evidence contracts/testing.md#distinguishing-cases Failed first and last commands surround a successful command; empty and all-success selections provide adjacent cases with no reported failures.
 * @evidence contracts/testing.md#execution-ownership Node registers exported test_validation_group_failures once; direct callback injection exercises runner control flow without spawning the product commands.
 */
const test_validation_group_failures = async () => {
  const steps = ["first", "second", "last"].map((run) => ({ run, dirs: [] }));
  const called = [];
  assert.deepEqual(await runAll(steps, (step) => {
    called.push(step.run);
    return step.run === "second" ? 0 : 1;
  }), ["first", "last"]);
  assert.deepEqual(called, ["first", "second", "last"]);
  assert.deepEqual(await runAll([], () => 0), []);
  assert.deepEqual(await runAll(steps, () => 0), []);
};

module.exports = { test_validation_group_failures };

test("a shared runner reports every failed command and still runs later suites", test_validation_group_failures);
