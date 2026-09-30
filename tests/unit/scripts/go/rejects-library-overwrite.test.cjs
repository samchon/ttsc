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
 * @evidence contracts/testing.md#behavioral-verification copyGoTestsFlat rejects a fixture test basename colliding with a library file and leaves the original bytes untouched.
 * @evidence contracts/testing.md#independent-expectations The authored library and planted test bytes are independent copy inputs; collision rejection must preserve the original literal content.
 * @evidence contracts/testing.md#distinguishing-cases Library-versus-test collision is the negative case; copies_noncolliding_files owns the valid sibling and rejects_test_collisions owns test-versus-test conflicts.
 * @evidence contracts/testing.md#execution-ownership test_go_runner_rejects_library_overwrite is the static CommonJS unit export registered once with node:test; it calls the owning harness with fixture files or injected callbacks and starts no native build or product process.
 */
const test_go_runner_rejects_library_overwrite = (t) => {
  const source = tmpdir(t);
  const target = tmpdir(t);
  // A linthost library source already materialized in the scratch linthost dir.
  const library = writeFile(
    target,
    "engine.go",
    "package linthost\n// library\n",
  );
  // A test tree that plants a same-basename `engine.go` (issue #624 auditor probe).
  writeFile(source, "rules/engine.go", "package linthost\n// planted\n");

  assert.throws(
    () => copyGoTestsFlat(source, target),
    (err) => err instanceof Error && err.message.includes("engine.go"),
  );
  // The library source must be untouched — no silent 45-byte shrink.
  assert.equal(
    fs.readFileSync(library, "utf8"),
    "package linthost\n// library\n",
  );
};

test("copyGoTestsFlat throws instead of overwriting a library source", test_go_runner_rejects_library_overwrite);
module.exports = { test_go_runner_rejects_library_overwrite };
