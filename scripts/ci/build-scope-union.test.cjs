const assert = require("node:assert/strict");
const { test } = require("node:test");
const { PLATFORM, SCOPES, selectBuild } = require("../build-current.cjs");

test("build unions preserve dependency order and link only needed native commands", () => {
  const combined = selectBuild("go-tests,test-lint,test-evidence,test-graph,test-lint");
  assert.equal(combined.plan.length, new Set(combined.plan).size);
  assert.ok(combined.plan.indexOf(PLATFORM) < combined.plan.indexOf("@ttsc/graph"));
  assert.ok(combined.plan.indexOf(PLATFORM) < combined.plan.indexOf("lint-contributor-demo"));
  for (const name of ["ttsc", "@ttsc/lint", "@ttsc/banner", "@ttsc/evidence", "@ttsc/graph", "@ttsc/unplugin", "lint-contributor-demo"])
    assert.ok(combined.plan.includes(name), name);
  assert.deepEqual(combined.platformTargets, ["ttsc", "ttscgraph"]);
  assert.equal(selectBuild("test-ttsc,test-lint").platformTargets, undefined);
  assert.ok(!selectBuild("go-tests").plan.includes(PLATFORM));
  assert.deepEqual(selectBuild("full").plan, SCOPES.full);
  assert.throws(() => selectBuild("test-lint,unknown"), /Unknown TTSC_BUILD_SCOPE/);
});
