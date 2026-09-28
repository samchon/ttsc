const assert = require("node:assert/strict");
const test = require("node:test");

const { runAll } = require("./run-typecheck-lane.cjs");

test("typecheck lane collects later failures after an earlier gate fails", () => {
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
});
