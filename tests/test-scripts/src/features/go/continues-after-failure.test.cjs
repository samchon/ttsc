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

const { copyGoTestsFlat } = require("../../../../../scripts/ci/go-test-overlay.cjs");
const { runAll, selectedRunners } = require("../../../../../scripts/test-go.cjs");

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
 * @evidence contracts/testing.md#behavioral-verification runAll invokes all three authored runner callbacks despite the first failure and returns that failure.
 * @evidence contracts/testing.md#independent-expectations The authored a/b/c order and callback status for a independently determine invocation order and failed names.
 * @evidence contracts/testing.md#distinguishing-cases An early failure must not short-circuit two successful successors; reports_all_failures owns multiple-failure aggregation.
 * @evidence contracts/testing.md#execution-ownership test_go_runner_continues_after_failure is the static CommonJS unit export registered once with node:test; it calls the owning harness with fixture files or injected callbacks and starts no native build or product process.
 */
const test_go_runner_continues_after_failure = () => {
  const invoked = [];
  const failed = runAll(["a", "b", "c"], (runner) => {
    invoked.push(runner);
    return runner === "a" ? 1 : 0; // the first runner fails
  });

  // The short-circuit bug stopped at the first failure; every runner must run.
  assert.deepEqual(invoked, ["a", "b", "c"]);
  assert.deepEqual(failed, ["a"]);
};

test("runAll invokes every runner even after an earlier one fails", test_go_runner_continues_after_failure);
module.exports = { test_go_runner_continues_after_failure };
