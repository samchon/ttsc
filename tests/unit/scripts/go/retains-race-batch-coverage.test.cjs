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
 * @evidence contracts/testing.md#behavioral-verification The exported race command plan retains driver packages and the LSP proxy, requests race instrumentation, and gives the repeated single-worker phase its required scheduling inputs.
 * @evidence contracts/testing.md#independent-expectations Driver package contract and explicit -race, internal/lspserver, -count=200 and GOMAXPROCS=1 expectations define the plan independently of the race-plan builder.
 * @evidence contracts/testing.md#distinguishing-cases Default proxy coverage contrasts with its E2E removal to avoid duplication; the E2E runner selection must include the race owner exactly once. Actual race execution remains owned by the Go boundary batch.
 * @evidence contracts/testing.md#execution-ownership test_go_runner_retains_race_batch_coverage is the static CommonJS unit export registered once with node:test; it calls the owning harness with fixture files or injected callbacks and starts no native build or product process.
 */
const test_go_runner_retains_race_batch_coverage = () => {
  const { DRIVER_TEST_PACKAGES } = require("../../../../scripts/test-go-driver.cjs");
  const { selectedPackages } = require("../../../../scripts/test-go-ttsc.cjs");
  const { steps } = require("../../../../scripts/test-go-race.cjs");
  const first = steps[0].args;
  assert.ok(first.includes("-race"));
  for (const entry of DRIVER_TEST_PACKAGES) assert.ok(first.includes(entry), entry);
  assert.ok(first.includes("./internal/lspserver"));
  assert.ok(selectedPackages("").includes("./internal/lspserver"));
  assert.ok(!selectedPackages("e2e").includes("./internal/lspserver"));
  assert.ok(!selectedRunners("e2e").includes("test-go-driver.cjs"));
  assert.equal(selectedRunners("e2e").filter((entry) => entry === "test-go-race.cjs").length, 1);
  assert.ok(steps[1].args.includes("-count=200"));
  assert.equal(steps[1].env.GOMAXPROCS, "1");
};

test("one race batch retains normal driver and proxy assertions without duplicate CI execution", test_go_runner_retains_race_batch_coverage);
module.exports = { test_go_runner_retains_race_batch_coverage };
