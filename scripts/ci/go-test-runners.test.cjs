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

const { copyGoTestsFlat } = require("./go-test-overlay.cjs");
const { runAll, runners } = require("../test-go.cjs");

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

test("copyGoTestsFlat throws instead of overwriting a library source", (t) => {
  const source = tmpdir(t);
  const target = tmpdir(t);
  // A linthost library source already materialized in the scratch linthost dir.
  const library = writeFile(target, "engine.go", "package linthost\n// library\n");
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
});

test("copyGoTestsFlat copies non-colliding test files", (t) => {
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
});

test("copyGoTestsFlat throws on a test-vs-test basename collision", (t) => {
  const source = tmpdir(t);
  const target = tmpdir(t);
  writeFile(source, "a/dispatch_test.go", "package linthost\n");
  writeFile(source, "b/dispatch_test.go", "package linthost\n");

  assert.throws(
    () => copyGoTestsFlat(source, target),
    (err) => err instanceof Error && err.message.includes("dispatch_test.go"),
  );
});

test("runAll invokes every runner even after an earlier one fails", () => {
  const invoked = [];
  const failed = runAll(["a", "b", "c"], (runner) => {
    invoked.push(runner);
    return runner === "a" ? 1 : 0; // the first runner fails
  });

  // The short-circuit bug stopped at the first failure; every runner must run.
  assert.deepEqual(invoked, ["a", "b", "c"]);
  assert.deepEqual(failed, ["a"]);
});

test("runAll reports every failing runner, not just the first", () => {
  const failed = runAll(["a", "b", "c"], (runner) => (runner === "b" ? 0 : 1));
  assert.deepEqual(failed, ["a", "c"]);
});

test("the orchestrator still lists the graph runner that used to be skipped", () => {
  assert.ok(
    runners.includes("test-go-graph.cjs"),
    "test-go-graph.cjs must stay in the aggregated runner list",
  );
});

test("the orchestrator runs the js/wasm host suite", () => {
  assert.ok(
    runners.includes("test-go-wasm.cjs"),
    "test-go-wasm.cjs must exercise the public wasm host API",
  );
});
