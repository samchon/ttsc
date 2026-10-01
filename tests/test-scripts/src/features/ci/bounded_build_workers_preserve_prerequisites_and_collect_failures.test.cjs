const assert = require("node:assert/strict");
const { test } = require("node:test");
const { PLATFORM, selectBuild, buildDependencies, runBuildPlan } = require("../../../../../scripts/build-current.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Calls real buildDependencies and runBuildPlan; checks package prerequisite policy, bounded concurrency, independent completion and transitive failure propagation.
 * @evidence contracts/testing.md#independent-expectations Authored root/independent/dependent/last graph and independently tracked completed callbacks determine legal start order and exact failures.
 * @evidence contracts/testing.md#distinguishing-cases Failed root must block two descendants but not independent work; all-success control must execute every node with prerequisites already completed.
 * @evidence contracts/testing.md#execution-ownership The actual asynchronous scheduler invokes private deterministic callbacks with short timers in one Node process; no package build is executed.
 */
const test_bounded_build_workers_preserve_prerequisites_and_collect_failures = async () => {
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
};

module.exports = { test_bounded_build_workers_preserve_prerequisites_and_collect_failures };

test("bounded build workers preserve prerequisites and finish independent failures", test_bounded_build_workers_preserve_prerequisites_and_collect_failures);
