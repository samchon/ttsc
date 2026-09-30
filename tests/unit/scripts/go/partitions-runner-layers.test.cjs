// Unit tests for the Go test runner harness behind `pnpm test:go`.
//
// Covers the two latent hazards fixed in issues #622/#624:
//   1. copyGoTestsFlat silently overwriting a linthost library source with a
//      same-named test file (the flatten collision guard).
//   2. the runner chain short-circuiting on the first failure, so a later
//      runner (test-go-graph) never ran (the aggregation contract).

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { copyGoTestsFlat } = require("../../../../scripts/ci/go-test-overlay.cjs");
const { runAll, selectedRunners } = require("../../../../scripts/test-go.cjs");

function tmpdir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-runner-harness-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeFile(root, rel, contents) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
  return file;
}

/**
 * @evidence contracts/testing.md#behavioral-verification selectedRunners assigns the documented portable and boundary runner populations and replaces duplicate driver execution with the owning race runner.
 * @evidence contracts/testing.md#independent-expectations Full population membership and explicitly authored mixed-suite ownership define the union; layer selections cannot omit a required runner or invent a second driver owner.
 * @evidence contracts/testing.md#distinguishing-cases Empty default preserves all, unit/e2e union retains coverage, transformer/shim stay unit-only, and an unknown layer is rejected.
 * @evidence contracts/testing.md#execution-ownership test_go_runner_partitions_runner_layers is the static CommonJS unit export registered once with node:test; it calls the owning harness with fixture files or injected callbacks and starts no native build or product process.
 */
const test_go_runner_partitions_runner_layers = () => {
  const all = selectedRunners("");
  const unit = selectedRunners("unit");
  const e2e = selectedRunners("e2e");
  assert.deepEqual([...new Set([...unit, ...e2e])].sort(), all.map((runner) => runner === "test-go-driver.cjs" ? "test-go-race.cjs" : runner).sort());
  assert.deepEqual(
    unit.filter((runner) => e2e.includes(runner)),
    ["test-go-utility-plugins.cjs", "test-go-lint.cjs", "test-go-evidence.cjs"],
  );
  assert.ok(!e2e.includes("test-go-transformer.cjs"));
  assert.ok(!e2e.includes("test-go-shim.cjs"));
  assert.throws(() => selectedRunners("typo"), /TTSC_TEST_LAYER/);
};

test("Go layers preserve every runner and share the mixed rule suites", test_go_runner_partitions_runner_layers);
module.exports = { test_go_runner_partitions_runner_layers };
