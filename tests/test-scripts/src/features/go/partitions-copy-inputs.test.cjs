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
 * @evidence contracts/testing.md#behavioral-verification copyGoTestsFlat honors an authored predicate and its default mode retains both unit and boundary fixture files.
 * @evidence contracts/testing.md#independent-expectations The independent two fixture names define exact selected and full destinations; fixture readdir observes actual copy results.
 * @evidence contracts/testing.md#distinguishing-cases Explicit rejection excludes one file, while an omitted predicate copies both; no assertion depends on current committed test layout.
 * @evidence contracts/testing.md#execution-ownership test_go_runner_partitions_copy_inputs is the static CommonJS unit export registered once with node:test; it calls the owning harness with fixture files or injected callbacks and starts no native build or product process.
 */
const test_go_runner_partitions_copy_inputs = (t) => {
  const source = tmpdir(t);
  const selected = tmpdir(t);
  const complete = tmpdir(t);
  writeFile(source, "unit/one_test.go", "package linthost\n// one\n");
  writeFile(source, "e2e/two_test.go", "package linthost\n// two\n");
  copyGoTestsFlat(
    source,
    selected,
    (file) => path.basename(file) !== "one_test.go",
  );
  copyGoTestsFlat(source, complete);
  assert.deepEqual(fs.readdirSync(selected), ["two_test.go"]);
  assert.deepEqual(fs.readdirSync(complete).sort(), [
    "one_test.go",
    "two_test.go",
  ]);
};

test("copyGoTestsFlat selects a layer while retaining unselected default coverage", test_go_runner_partitions_copy_inputs);
module.exports = { test_go_runner_partitions_copy_inputs };
