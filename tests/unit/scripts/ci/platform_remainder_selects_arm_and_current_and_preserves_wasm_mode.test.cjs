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
 * @evidence contracts/testing.md#behavioral-verification Calls selectPlatformPackageDirs and packageBuildScript on literal platform identities and checks all/remainder/error and WASM TypeScript-only selection.
 * @evidence contracts/testing.md#independent-expectations Seven authored platform directory names define the expected Linux ARM plus current-x64 remainder without reading repository files.
 * @evidence contracts/testing.md#distinguishing-cases All mode retains every platform, remainder returns ARM/current only, invalid mode rejects, and WASM remainder differs from normal full build.
 * @evidence contracts/testing.md#execution-ownership The actual classifiers consume synthetic resolved paths and return command names in process; this is selection behavior rather than file-presence or binary verification.
 */
const test_platform_remainder_selects_arm_and_current_and_preserves_wasm_mode = () => {
  const all = [
    "ttsc-linux-arm",
    "ttsc-linux-x64",
    "ttsc-linux-arm64",
    "ttsc-darwin-x64",
    "ttsc-darwin-arm64",
    "ttsc-win32-x64",
    "ttsc-win32-arm64",
  ].map((entry) => path.resolve(__dirname, "../../../..", "packages", entry));
  const current = all[1];
  assert.deepEqual(selectPlatformPackageDirs(all, "all", current), all);
  assert.deepEqual(selectPlatformPackageDirs(all, "ci-remainder", current), all.slice(0, 2));
  assert.throws(() => selectPlatformPackageDirs(all, "invalid", current), /unknown/);
  assert.equal(packageBuildScript("@ttsc/wasm", "ci-remainder"), "build:ts");
  assert.equal(packageBuildScript("@ttsc/wasm", "all"), "build");
};

module.exports = { test_platform_remainder_selects_arm_and_current_and_preserves_wasm_mode };

test("CI builds the Linux ARM remainder and its local graph compiler", test_platform_remainder_selects_arm_and_current_and_preserves_wasm_mode);
