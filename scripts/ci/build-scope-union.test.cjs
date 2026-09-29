const assert = require("node:assert/strict");
const { test } = require("node:test");
const { PLATFORM, SCOPES, selectBuild, buildDependencies, runBuildPlan } = require("../build-current.cjs");

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
  assert.deepEqual(selectBuild("install-smoke").plan, ["ttsc", PLATFORM]);
  assert.deepEqual(selectBuild("install-smoke").platformTargets, ["ttsc"]);
  assert.throws(() => selectBuild("test-lint,unknown"), /Unknown TTSC_BUILD_SCOPE/);
});

test("bounded build workers preserve prerequisites and finish independent failures", async () => {
  const plan = selectBuild("full").plan;
  const dependencies = buildDependencies(plan);
  assert.ok(dependencies.get("@ttsc/graph").includes(PLATFORM));
  assert.ok(dependencies.get("@ttsc/metro").includes("@ttsc/unplugin"));
  assert.ok(dependencies.get("@ttsc/playground").some((item) => item.filter === "@ttsc/wasm"));
  assert.deepEqual(dependencies.get("@ttsc/vscode"), plan.filter((item) => item !== "@ttsc/vscode"));

  const sample = ["root", "independent", "dependent", "last"];
  const edges = new Map([
    ["root", []], ["independent", []],
    ["dependent", ["root"]], ["last", ["dependent"]],
  ]);
  const completed = new Set();
  const started = [];
  let active = 0;
  let peak = 0;
  const failed = await runBuildPlan(sample, edges, async (item) => {
    for (const dependency of edges.get(item)) assert.ok(completed.has(dependency));
    started.push(item);
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    completed.add(item);
    return item === "root" ? 1 : 0;
  }, 2);
  assert.deepEqual(failed, ["root", "dependent", "last"]);
  assert.deepEqual(started.sort(), ["independent", "root"]);
  assert.equal(peak, 2);

  const successful = new Set();
  const clean = await runBuildPlan(sample, edges, async (item) => {
    for (const dependency of edges.get(item)) assert.ok(successful.has(dependency));
    await new Promise((resolve) => setTimeout(resolve, 1));
    successful.add(item);
    return 0;
  }, 2);
  assert.deepEqual(clean, []);
  assert.deepEqual([...successful].sort(), [...sample].sort());
});
