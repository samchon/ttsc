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
} = require("../../../../scripts/ci/node-tests.cjs");

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
 * @evidence contracts/testing.md#behavioral-verification Calls selectedNodeTests for all three lanes and checks the unit/E2E union, exact representative unit populations and invalid-layer rejection.
 * @evidence contracts/testing.md#independent-expectations Literal representative process-boundary and in-process paths supply the independent layer controls; complete discovered membership must be conserved.
 * @evidence contracts/testing.md#distinguishing-cases Go runner belongs to units while wasm execution and loader/package checks belong to E2E; an unknown layer must fail rather than drop all tests.
 * @evidence contracts/testing.md#execution-ownership The actual selectors consume a synthetic directory inventory in process; this tests execution ownership policy and does not execute any represented process boundary.
 */
const test_node_test_layers_preserve_a_complete_disjoint_partition = (
  t,
) => {
  const root = workspace(t, [
    "scripts/go-test-runners.test.cjs",
    "scripts/go-wasm-exec.test.cjs",
    "scripts/ci/typescript-loader.test.cjs",
    "scripts/ci/validation-group-failures.test.cjs",
    "scripts/ci/package/factory-package.test.cjs",
  ]);
  for (const lane of ["go", "typecheck", "package-defenses"]) {
    const units = selectedNodeTests(root, lane, "unit");
    const e2e = selectedNodeTests(root, lane, "e2e");
    assert.deepEqual([...units, ...e2e].sort(), discoverNodeTests(root, lane));
    assert.ok(units.every((file) => nodeTestLayer(file) === "unit"));
    assert.ok(e2e.every((file) => nodeTestLayer(file) === "e2e"));
  }
  assert.deepEqual(selectedNodeTests(root, "go", "unit"), [
    "scripts/go-test-runners.test.cjs",
  ]);
  assert.deepEqual(selectedNodeTests(root, "package-defenses", "unit"), []);
  assert.throws(() => selectedNodeTests(root, "go", "typo"), /TTSC_TEST_LAYER/);
};

module.exports = { test_node_test_layers_preserve_a_complete_disjoint_partition };

test("unit and e2e selections partition discovered tests without dropping boundaries", test_node_test_layers_preserve_a_complete_disjoint_partition);
