const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const {
  finishPlatformBuilds,
  PACKAGE_BUILDS_BEFORE_PLATFORMS,
  packageBuildScript,
  selectPlatformPackageDirs,
} = require("../../../../../scripts/build-platforms.cjs");
const { buildDependencies } = require("../../../../../scripts/build-current.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Calls finishPlatformBuilds with foreign versus current target failures and checks all three callbacks run while graph depends only on current success.
 * @evidence contracts/testing.md#independent-expectations Literal foreign/current/last inputs and callback return statuses independently define the failed target and graph eligibility.
 * @evidence contracts/testing.md#distinguishing-cases Foreign failure must allow graph, current failure must suppress graph, and both must still finish the last independent platform.
 * @evidence contracts/testing.md#execution-ownership Real scheduling executes private async callbacks in process; represented compiler builds and graph compilation are never started.
 */
const test_platform_failures_preserve_independent_work_and_gate_graph = async () => {
  for (const broken of ["foreign", "current"]) {
    const called = [];
    const failed = await finishPlatformBuilds(
      ["foreign", "current", "last"],
      async (target) => {
        called.push(target);
        return target === broken ? 1 : 0;
      },
      "current",
      () => called.push("graph"),
      2,
    );
    assert.deepEqual(failed, [broken]);
    assert.deepEqual(called.slice(0, 3), ["foreign", "current", "last"]);
    assert.equal(called.includes("graph"), broken !== "current");
  }
};

module.exports = { test_platform_failures_preserve_independent_work_and_gate_graph };

test("platform failures finish every target and block only dependent graph work", test_platform_failures_preserve_independent_work_and_gate_graph);
