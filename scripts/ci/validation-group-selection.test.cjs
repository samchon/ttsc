const assert = require("node:assert/strict");
const { test } = require("node:test");
const { fullPlan, LANES, validationSteps, planForPaths } = require("./validation-plan.cjs");

test("grouping retains the full Linux inventory and batches each executor once", () => {
  const plan = fullPlan("test");
  assert.equal(plan.matrix.include.length, 7);
  assert.equal(plan.matrix.include.length + plan.platformMatrix.include.length + plan.unpluginMatrix.include.length + 2, 16);
  assert.equal(plan.platformMatrix.include.filter((row) => row.contract_lanes).length, 2);
  assert.ok(plan.platformMatrix.include.filter((row) => row.contract_lanes).every((row) => row.build && row.vscode_prebuilt));
  for (const lane of LANES.filter((entry) => !entry.os)) {
    const job = plan.matrix.include.find((entry) => entry.os === "ubuntu-latest" && entry.lanes.split(",").includes(lane.id));
    assert.ok(job, lane.id);
    const steps = validationSteps(job.lanes.split(","));
    for (const command of lane.run.split(" && ")) assert.ok(steps.some((step) => step.run === command), command);
    for (const dir of lane.dirs ?? []) assert.ok(steps.some((step) => lane.run.split(" && ").includes(step.run) && step.dirs.includes(dir)), dir);
  }
  const compiler = validationSteps(["ttsc-core", "ttsc-native"]);
  assert.equal(compiler.length, 1);
  assert.equal(compiler[0].dirs.length, new Set(compiler[0].dirs).size);
  const lint = validationSteps(["lint-1", "lint-2"]);
  assert.equal(lint.length, 1);
  assert.ok(lint[0].dirs.every((dir) => !dir.includes("corpus")));
  assert.ok(planForPaths(["tests/test-lint/src/cases/no-var.ts"]).laneIds.includes("go"));
  assert.ok(planForPaths(["tests/utils/src/lint/TestLint.ts"]).laneIds.includes("go"));
  const os = validationSteps(["ttsc-core", "ttsc-native", "evidence"], "win32");
  assert.ok(os[0].dirs.includes("native-plugins/service"));
  assert.ok(os[0].dirs.includes("native-plugins/corpus-misc"));
  assert.ok(os[0].dirs.includes("native-plugins/cli"));
  assert.ok(os.some((step) => step.run.includes("resident_graph_session")));
  assert.ok(os.every((step) => !step.run.includes("test-evidence-benchmark")));
  assert.throws(() => validationSteps(["typo"]), /unknown validation lane/);
});
