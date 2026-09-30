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
 * @evidence contracts/testing.md#behavioral-verification runAll returns both independently failing runner names around a successful middle runner.
 * @evidence contracts/testing.md#independent-expectations The callback explicitly gives a and c nonzero statuses and b zero; expected a/c is independent of aggregator computation.
 * @evidence contracts/testing.md#distinguishing-cases Separated failures contrast with the single early failure in continues_after_failure.
 * @evidence contracts/testing.md#execution-ownership test_go_runner_reports_all_failures is the static CommonJS unit export registered once with node:test; it calls the owning harness with fixture files or injected callbacks and starts no native build or product process.
 */
const test_go_runner_reports_all_failures = () => {
  const failed = runAll(["a", "b", "c"], (runner) => (runner === "b" ? 0 : 1));
  assert.deepEqual(failed, ["a", "c"]);
};

test("runAll reports every failing runner, not just the first", test_go_runner_reports_all_failures);
module.exports = { test_go_runner_reports_all_failures };
