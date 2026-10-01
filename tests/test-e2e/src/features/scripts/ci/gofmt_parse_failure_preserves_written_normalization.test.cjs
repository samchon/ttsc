const assert = require("node:assert/strict");
const { test } = require("node:test");
const { normalized, written } = require("./internal/gofmt-wrapper.cjs");

/**
 * Verifies parse failures still normalize every named file.
 *
 * Two valid writes and one malformed source require status two and exact final
 * bytes for all three files.
 *
 * 1. Exercise the unchanged formatter wrapper with the original fixture.
 * 2. Require the original observable output and failure assertions.
 *
 * @evidence contracts/testing.md#behavioral-verification Parse failures still normalize every named file through the actual Go formatter and literal-aware Perl wrapper; the original assertions are retained.
 * @evidence contracts/testing.md#independent-expectations Literal Go inputs, expected bytes, regexes and process outcomes are preserved from the existing regression rather than derived by the new batch implementation.
 * @evidence contracts/testing.md#distinguishing-cases Two valid writes and one malformed source require status two and exact final bytes for all three files.
 * @evidence contracts/testing.md#execution-ownership This single named export is registered once by its physical E2E file in the shared Node formatter population; real formatter processes remain in E2E.
 * @evidence contracts/e2e.md#necessary-boundary Go output and Perl normalization are connected by the actual shell wrapper; direct calls cannot verify this process and literal-payload boundary.
 * @evidence contracts/e2e.md#shared-execution The maintained harness shares wrapper/helper source preparation code; this case retains only its original stdin or mutable-write process requests, with no installation or plugin build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each mutable wrapper fixture is owned by the harness and removed in finally after the process and all assertions complete; separate contents cannot affect another case.
 * @evidence contracts/e2e.md#preserved-coverage The original callback body, inputs, assertion calls and failure messages move unchanged to this executable named owner; no original distinction is removed.
 */
const test_gofmt_parse_failure_preserves_written_normalization = () => {
  const result = written({
    "a.go": "package a\n\nfunc A() {\nprintln(1)\n}\n",
    "b.go": "package a\n\nfunc B() {\nprintln(2)\n}\n",
    "broken.go": "package a\n\nfunc C( {\n\tprintln(3)\n}\n",
  });
  assert.equal(
    result.status,
    2,
    "gofmt's own parse-error status is what the wrapper has to report",
  );
  assert.equal(
    result.after["a.go"],
    "package a\n\nfunc A() {\n  println(1)\n}\n",
  );
  assert.equal(
    result.after["b.go"],
    "package a\n\nfunc B() {\n  println(2)\n}\n",
  );
  // The unparseable file is normalized too, and that is the decision rather
  // than an accident: the pass runs over the files that were named, not over
  // the subset gofmt happened to accept. gofmt left this one alone, so what it
  // gets is the tab substitution and nothing else.
  assert.equal(
    result.after["broken.go"],
    "package a\n\nfunc C( {\n  println(3)\n}\n",
  );
};

module.exports = { test_gofmt_parse_failure_preserves_written_normalization };

test(
  "a gofmt failure still leaves the files it wrote normalized",
  test_gofmt_parse_failure_preserves_written_normalization,
);
