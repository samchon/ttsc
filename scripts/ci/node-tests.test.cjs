const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { discoverNodeTests, nodeTestLane } = require("./node-tests.cjs");

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

test("a new test joins the lane its directory names without editing a list", (t) => {
  const root = workspace(t, [
    "scripts/new-harness.test.cjs",
    "scripts/ci/new-tooling.test.cjs",
    "scripts/ci/package/new-package.test.cjs",
    "packages/tool/scripts/new-build.test.cjs",
    "scripts/helper.cjs",
    "scripts/ci/node_modules/dep/ignored.test.cjs",
  ]);
  assert.deepEqual(discoverNodeTests(root, "go"), [
    "scripts/new-harness.test.cjs",
  ]);
  assert.deepEqual(discoverNodeTests(root, "package-defenses"), [
    "scripts/ci/package/new-package.test.cjs",
  ]);
  assert.deepEqual(discoverNodeTests(root, "typecheck"), [
    "packages/tool/scripts/new-build.test.cjs",
    "scripts/ci/new-tooling.test.cjs",
  ]);
});

test("a test no lane owns fails discovery by name instead of running nowhere", (t) => {
  const root = workspace(t, ["scripts/elsewhere/orphan.test.cjs"]);
  assert.throws(
    () => discoverNodeTests(root, "typecheck"),
    /no CI lane runs scripts\/elsewhere\/orphan\.test\.cjs/,
  );
  assert.equal(nodeTestLane("scripts/elsewhere/orphan.test.cjs"), undefined);
});
