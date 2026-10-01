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
 * @evidence contracts/testing.md#behavioral-verification copyGoTestsFlat rejects two nested inputs with one basename instead of silently selecting the later file.
 * @evidence contracts/testing.md#independent-expectations The independently authored a/dispatch_test.go and b/dispatch_test.go cannot both occupy the flat destination; the error must identify dispatch_test.go.
 * @evidence contracts/testing.md#distinguishing-cases Nested test-versus-test collision contrasts with copies_noncolliding_files and rejects_library_overwrite.
 * @evidence contracts/testing.md#execution-ownership test_go_runner_rejects_test_collisions is the static CommonJS unit export registered once with node:test; it calls the owning harness with fixture files or injected callbacks and starts no native build or product process.
 */
const test_go_runner_rejects_test_collisions = (t) => {
  const source = tmpdir(t);
  const target = tmpdir(t);
  writeFile(source, "a/dispatch_test.go", "package linthost\n");
  writeFile(source, "b/dispatch_test.go", "package linthost\n");

  assert.throws(
    () => copyGoTestsFlat(source, target),
    (err) => err instanceof Error && err.message.includes("dispatch_test.go"),
  );
};

test("copyGoTestsFlat throws on a test-vs-test basename collision", test_go_runner_rejects_test_collisions);
module.exports = { test_go_runner_rejects_test_collisions };
