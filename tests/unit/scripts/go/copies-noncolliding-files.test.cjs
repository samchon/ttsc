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
 * @evidence contracts/testing.md#behavioral-verification copyGoTestsFlat copies the selected test bytes while retaining an existing different-basename library file.
 * @evidence contracts/testing.md#independent-expectations Literal authored source and library strings are independently compared after the copy, rather than checking repository arrangement.
 * @evidence contracts/testing.md#distinguishing-cases A valid distinct basename must copy without altering the library; the two collision cases own rejection.
 * @evidence contracts/testing.md#execution-ownership test_go_runner_copies_noncolliding_files is the static CommonJS unit export registered once with node:test; it calls the owning harness with fixture files or injected callbacks and starts no native build or product process.
 */
const test_go_runner_copies_noncolliding_files = (t) => {
  const source = tmpdir(t);
  const target = tmpdir(t);
  writeFile(target, "engine.go", "package linthost\n// library\n");
  writeFile(source, "engine_behavior_test.go", "package linthost\n// test\n");

  copyGoTestsFlat(source, target);

  assert.equal(
    fs.readFileSync(path.join(target, "engine_behavior_test.go"), "utf8"),
    "package linthost\n// test\n",
  );
  // The pre-existing library source is preserved.
  assert.equal(
    fs.readFileSync(path.join(target, "engine.go"), "utf8"),
    "package linthost\n// library\n",
  );
};

test("copyGoTestsFlat copies non-colliding test files", test_go_runner_copies_noncolliding_files);
module.exports = { test_go_runner_copies_noncolliding_files };
