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
 * @evidence contracts/testing.md#behavioral-verification Calls discoverNodeTests and nodeTestLane with an orphan .test.cjs path and checks the explicit missing-owner rejection.
 * @evidence contracts/testing.md#independent-expectations The independently authored scripts/elsewhere/orphan.test.cjs path is outside all declared ownership shapes and must be named in the failure.
 * @evidence contracts/testing.md#distinguishing-cases The preceding discovery case covers owned paths; this named case prevents an unowned executable test from being silently omitted.
 * @evidence contracts/testing.md#execution-ownership Only the actual path classifier and filesystem walker run over a private tree, and fixture cleanup belongs to the Node test context.
 */
const test_node_test_discovery_rejects_an_unowned_test = (t) => {
  const root = workspace(t, ["scripts/elsewhere/orphan.test.cjs"]);
  assert.throws(
    () => discoverNodeTests(root, "typecheck"),
    /no CI lane runs scripts\/elsewhere\/orphan\.test\.cjs/,
  );
  assert.equal(nodeTestLane("scripts/elsewhere/orphan.test.cjs"), undefined);
};

module.exports = { test_node_test_discovery_rejects_an_unowned_test };

test("a test no lane owns fails discovery by name instead of running nowhere", test_node_test_discovery_rejects_an_unowned_test);
