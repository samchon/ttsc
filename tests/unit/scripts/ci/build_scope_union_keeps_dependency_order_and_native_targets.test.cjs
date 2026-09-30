const assert = require("node:assert/strict");
const { test } = require("node:test");
const { PLATFORM, selectBuild, buildDependencies, runBuildPlan } = require("../../../../scripts/build-current.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Calls selectBuild for overlapping, Go-only, install and unknown scopes and checks unique dependency order plus native target union.
 * @evidence contracts/testing.md#independent-expectations Literal expected package owners and ttsc/ttscgraph commands define the selected behavior independently of the SCOPES table.
 * @evidence contracts/testing.md#distinguishing-cases Repeated lint scope cannot duplicate a build; Go-only omits platform linking, install keeps compiler/platform order and unknown scope rejects.
 * @evidence contracts/testing.md#execution-ownership Real planning functions execute in process; no callback performs a build or installs a consumer.
 */
const test_build_scope_union_keeps_dependency_order_and_native_targets = () => {
  const combined = selectBuild("go-tests,test-lint,test-evidence,test-graph,test-lint");
  assert.equal(combined.plan.length, new Set(combined.plan).size);
  assert.ok(combined.plan.indexOf(PLATFORM) < combined.plan.indexOf("@ttsc/graph"));
  assert.ok(combined.plan.indexOf(PLATFORM) < combined.plan.indexOf("lint-contributor-demo"));
  for (const name of ["ttsc", "@ttsc/lint", "@ttsc/banner", "@ttsc/evidence", "@ttsc/graph", "@ttsc/unplugin", "lint-contributor-demo"])
    assert.ok(combined.plan.includes(name), name);
  assert.deepEqual(combined.platformTargets, ["ttsc", "ttscgraph"]);
  assert.equal(selectBuild("test-ttsc,test-lint").platformTargets, undefined);
  assert.ok(!selectBuild("go-tests").plan.includes(PLATFORM));
  assert.deepEqual(selectBuild("install-smoke").plan, ["ttsc", PLATFORM]);
  assert.equal(selectBuild("install-smoke").platformTargets, undefined);
  assert.throws(() => selectBuild("test-lint,unknown"), /Unknown TTSC_BUILD_SCOPE/);
};

module.exports = { test_build_scope_union_keeps_dependency_order_and_native_targets };

test("build unions preserve dependency order and link only needed native commands", test_build_scope_union_keeps_dependency_order_and_native_targets);
