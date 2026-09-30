const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const {
  finishPlatformBuilds,
  PACKAGE_BUILDS_BEFORE_PLATFORMS,
  packageBuildScript,
  selectPlatformPackageDirs,
} = require("../../../../scripts/build-platforms.cjs");
const { buildDependencies } = require("../../../../scripts/build-current.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Calls buildDependencies over the platform package plan and checks prerequisites precede targets, WASM before playground and VSCode after all peers.
 * @evidence contracts/testing.md#independent-expectations Plan positions and literal WASM/playground/VSCode owner relationships define required scheduler dependencies rather than checking workflow text.
 * @evidence contracts/testing.md#distinguishing-cases Each dependency edge must point backward; missing WASM edge or one missing VSCode peer fails before a build could race mutable manifest state.
 * @evidence contracts/testing.md#execution-ownership Only actual dependency planning runs in process; the maintained plan is behavioral input and no package artifact is inspected or built.
 */
const test_platform_package_plan_preserves_import_and_manifest_prerequisites = () => {
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
};

module.exports = { test_platform_package_plan_preserves_import_and_manifest_prerequisites };

test("full package build waits for imports and serializes manifest-mutating VS Code packaging", test_platform_package_plan_preserves_import_and_manifest_prerequisites);
