const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  finishPlatformBuilds,
  PACKAGE_BUILDS_BEFORE_PLATFORMS,
} = require("../build-platforms.cjs");
const { buildDependencies } = require("../build-current.cjs");

test("full package build waits for imports and serializes manifest-mutating VS Code packaging", () => {
  const plan = PACKAGE_BUILDS_BEFORE_PLATFORMS;
  const dependencies = buildDependencies(plan);
  for (const [target, parents] of dependencies)
    for (const parent of parents)
      assert.ok(
        plan.indexOf(parent) < plan.indexOf(target),
        `${parent} before ${target}`,
      );
  assert.ok(dependencies.get("@ttsc/playground").includes("@ttsc/wasm"));
  assert.deepEqual(
    dependencies.get("@ttsc/vscode"),
    plan.filter((target) => target !== "@ttsc/vscode"),
  );
});

test("platform failures finish every target and block only dependent graph work", async () => {
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
});
