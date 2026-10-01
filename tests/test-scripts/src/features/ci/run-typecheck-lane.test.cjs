const assert = require("node:assert/strict");
const test = require("node:test");

const { runAll } = require("../../../../../scripts/ci/run-typecheck-lane.cjs");

/**
 * Verifies typecheck collection does not stop at a failed gate.
 *
 * Formatting and type diagnostics remain observable after an independent failure.
 *
 * 1. Return failures before and after a successful callback.
 * 2. Assert every callback ran and failure names retain input order.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the typecheck lane's runAll and checks complete callback order plus returned failure names, detecting short-circuiting and failures attributed to a successful gate.
 * @evidence contracts/testing.md#independent-expectations The callback returns success only for the unplugin fixture name, so the independently authored expected list contains exactly the other two input names.
 * @evidence contracts/testing.md#distinguishing-cases A failed first gate, successful middle gate and failed last gate distinguish continued collection; empty and all-success inputs must produce no failures.
 * @evidence contracts/testing.md#execution-ownership Exported test_run_typecheck_lane is registered once with Node and exercises synchronous runner policy directly, without invoking an actual build or typecheck subprocess.
 */
const test_run_typecheck_lane = () => {
  const seen = [];
  const steps = [
    { name: "format check" },
    { name: "unplugin features" },
    { name: "TypeScript types" },
  ];
  const failed = runAll(steps, (step) => {
    seen.push(step.name);
    return step.name === "unplugin features" ? 0 : 1;
  });
  assert.deepEqual(seen, steps.map((step) => step.name));
  assert.deepEqual(failed, ["format check", "TypeScript types"]);
  assert.deepEqual(runAll([], () => 0), []);
  assert.deepEqual(runAll(steps, () => 0), []);
};

module.exports = { test_run_typecheck_lane };

test("typecheck lane collects later failures after an earlier gate fails", test_run_typecheck_lane);
