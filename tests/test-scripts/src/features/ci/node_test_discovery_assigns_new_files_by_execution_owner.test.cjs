const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  discoverNodeTests,
  nodeTestLane,
  nodeTestLayer,
  selectedNodeTests,
} = require("../../../../../scripts/ci/node-tests.cjs");

function workspace(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-node-tests-"));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  for (const file of files) {
    const location = path.join(root, ...file.split("/"));
    fs.mkdirSync(path.dirname(location), { recursive: true });
    fs.writeFileSync(location, "");
  }
  fs.mkdirSync(path.join(root, "packages"), { recursive: true });
  return root;
}

/**
 * @evidence contracts/testing.md#behavioral-verification Calls discoverNodeTests on new synthetic harness, tooling, packed-package and package-build paths and checks exact sorted ownership.
 * @evidence contracts/testing.md#independent-expectations Authored empty fixture names independently determine the literal go, typecheck and package-defense results; their content is intentionally irrelevant to discovery.
 * @evidence contracts/testing.md#distinguishing-cases A non-test helper and nested node_modules test must remain absent while every recognized path joins its owning lane without a manual entry.
 * @evidence contracts/testing.md#execution-ownership The actual filesystem discovery executes in process over one private temporary tree; no package installation or child process runs.
 */
const test_node_test_discovery_assigns_new_files_by_execution_owner = (t) => {
  const root = workspace(t, [
    "scripts/new-harness.test.cjs",
    "scripts/ci/new-tooling.test.cjs",
    "scripts/ci/package/new-package.test.cjs",
    "packages/tool/scripts/new-build.test.cjs",
    "scripts/helper.cjs",
    "scripts/ci/node_modules/dep/ignored.test.cjs",
    "tests/test-scripts/src/features/go/new-cache.test.cjs",
    "tests/test-scripts/src/features/ci/new-selector.test.cjs",
  ]);
  assert.deepEqual(discoverNodeTests(root, "go"), [
    "scripts/new-harness.test.cjs",
    "tests/test-scripts/src/features/go/new-cache.test.cjs",
  ]);
  assert.deepEqual(discoverNodeTests(root, "package-defenses"), [
    "scripts/ci/package/new-package.test.cjs",
  ]);
  assert.deepEqual(discoverNodeTests(root, "typecheck"), [
    "packages/tool/scripts/new-build.test.cjs",
    "scripts/ci/new-tooling.test.cjs",
    "tests/test-scripts/src/features/ci/new-selector.test.cjs",
  ]);
};

module.exports = { test_node_test_discovery_assigns_new_files_by_execution_owner };

test("a new test joins the lane its directory names without editing a list", test_node_test_discovery_assigns_new_files_by_execution_owner);
