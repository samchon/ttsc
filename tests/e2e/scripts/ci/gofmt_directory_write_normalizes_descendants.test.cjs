const assert = require("node:assert/strict");
const { test } = require("node:test");
const { written } = require("./internal/gofmt-wrapper.cjs");

/**
 * Verifies directory writes normalize every nested go file.
 *
 * A directory argument includes both an immediate and a deeper Go file, each
 * with exact two-space output.
 *
 * 1. Exercise the unchanged formatter wrapper with the original fixture.
 * 2. Require the original observable output and failure assertions.
 *
 * @evidence contracts/testing.md#behavioral-verification Directory writes normalize every nested Go file through the actual Go formatter and literal-aware Perl wrapper; the original assertions are retained.
 * @evidence contracts/testing.md#independent-expectations Literal Go inputs, expected bytes, regexes and process outcomes are preserved from the existing regression rather than derived by the new batch implementation.
 * @evidence contracts/testing.md#distinguishing-cases A directory argument includes both an immediate and a deeper Go file, each with exact two-space output.
 * @evidence contracts/testing.md#execution-ownership This single named export is registered once by its physical E2E file in the shared Node formatter population; real formatter processes remain in E2E.
 * @evidence contracts/e2e.md#necessary-boundary Go output and Perl normalization are connected by the actual shell wrapper; direct calls cannot verify this process and literal-payload boundary.
 * @evidence contracts/e2e.md#shared-execution The maintained harness shares wrapper/helper source preparation code; this case retains only its original stdin or mutable-write process requests, with no installation or plugin build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each mutable wrapper fixture is owned by the harness and removed in finally after the process and all assertions complete; separate contents cannot affect another case.
 * @evidence contracts/e2e.md#preserved-coverage The original callback body, inputs, assertion calls and failure messages move unchanged to this executable named owner; no original distinction is removed.
 */
const test_gofmt_directory_write_normalizes_descendants = () => {
  // `gofmt -w` accepts a directory and writes every Go file beneath it. The
  // normalization used to run only over arguments spelled as existing `.go`
  // paths, so a directory left the whole tree tab-indented and exited 0 — the
  // silent version of the failure the case above makes loud.
  const result = written(
    {
      "sub/a.go": "package a\n\nfunc A() {\nprintln(1)\n}\n",
      "sub/deep/b.go": "package b\n\nfunc B() {\nprintln(2)\n}\n",
    },
    ["sub"],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.after["sub/a.go"],
    "package a\n\nfunc A() {\n  println(1)\n}\n",
  );
  assert.equal(
    result.after["sub/deep/b.go"],
    "package b\n\nfunc B() {\n  println(2)\n}\n",
  );
};

module.exports = { test_gofmt_directory_write_normalizes_descendants };

test(
  "a directory argument normalizes every file gofmt wrote under it",
  test_gofmt_directory_write_normalizes_descendants,
);
