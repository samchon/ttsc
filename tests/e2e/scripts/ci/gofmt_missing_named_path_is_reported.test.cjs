const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { written } = require("./internal/gofmt-wrapper.cjs");

/**
 * Verifies a missing path fails while the valid sibling is formatted.
 *
 * The missing filename must appear in stderr; the valid sibling must still have
 * its exact formatted bytes.
 *
 * 1. Exercise the unchanged formatter wrapper with the original fixture.
 * 2. Require the original observable output and failure assertions.
 *
 * @evidence contracts/testing.md#behavioral-verification A missing path fails while the valid sibling is formatted through the actual Go formatter and literal-aware Perl wrapper; the original assertions are retained.
 * @evidence contracts/testing.md#independent-expectations Literal Go inputs, expected bytes, regexes and process outcomes are preserved from the existing regression rather than derived by the new batch implementation.
 * @evidence contracts/testing.md#distinguishing-cases The missing filename must appear in stderr; the valid sibling must still have its exact formatted bytes.
 * @evidence contracts/testing.md#execution-ownership This single named export is registered once by its physical E2E file in the shared Node formatter population; real formatter processes remain in E2E.
 * @evidence contracts/e2e.md#necessary-boundary Go output and Perl normalization are connected by the actual shell wrapper; direct calls cannot verify this process and literal-payload boundary.
 * @evidence contracts/e2e.md#shared-execution The maintained harness shares wrapper/helper source preparation code; this case retains only its original stdin or mutable-write process requests, with no installation or plugin build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each mutable wrapper fixture is owned by the harness and removed in finally after the process and all assertions complete; separate contents cannot affect another case.
 * @evidence contracts/e2e.md#preserved-coverage The original callback body, inputs, assertion calls and failure messages move unchanged to this executable named owner; no original distinction is removed.
 */
const test_gofmt_missing_named_path_is_reported = () => {
  // The negative twin of the directory case. A path matching `*.go` that did not
  // exist used to be dropped from the gofmt arguments as well as from the
  // normalization, so a typo in a format command was a silent success.
  //
  // The missing name is passed ALONGSIDE a real one, which is the shape that
  // discriminates: with a missing name alone, gofmt would receive `-w` and no
  // file and reject that instead, so the case would pass against the defect.
  const result = written(
    { "a.go": "package a\n\nfunc A() {\nprintln(1)\n}\n" },
    ["a.go", "missing.go"],
  );
  assert.notEqual(result.status, 0, "a missing path has to be reported");
  assert.match(
    result.stderr,
    /missing\.go/,
    `stderr does not name the missing path: ${result.stderr}`,
  );
  assert.equal(
    result.after["a.go"],
    "package a\n\nfunc A() {\n  println(1)\n}\n",
    "the file that does exist still has to be formatted",
  );
};

module.exports = { test_gofmt_missing_named_path_is_reported };

test(
  "a named path that does not exist is reported, not silently skipped",
  test_gofmt_missing_named_path_is_reported,
);
