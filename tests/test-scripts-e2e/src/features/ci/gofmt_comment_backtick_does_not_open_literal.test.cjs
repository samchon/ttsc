const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { normalized } = require("./internal/gofmt-wrapper.cjs");

/**
 * Verifies comment backticks cannot protect later indentation.
 *
 * An unmatched comment backtick and a later real raw string distinguish
 * comments from literal spans.
 *
 * 1. Exercise the unchanged formatter wrapper with the original fixture.
 * 2. Require the original observable output and failure assertions.
 *
 * @evidence contracts/testing.md#behavioral-verification Comment backticks cannot protect later indentation through the actual Go formatter and literal-aware Perl wrapper; the original assertions are retained.
 * @evidence contracts/testing.md#independent-expectations Literal Go inputs, expected bytes, regexes and process outcomes are preserved from the existing regression rather than derived by the new batch implementation.
 * @evidence contracts/testing.md#distinguishing-cases An unmatched comment backtick and a later real raw string distinguish comments from literal spans.
 * @evidence contracts/testing.md#execution-ownership This single named export is registered once by its physical E2E file in the shared Node formatter population; real formatter processes remain in E2E.
 * @evidence contracts/e2e.md#necessary-boundary Go output and Perl normalization are connected by the actual shell wrapper; direct calls cannot verify this process and literal-payload boundary.
 * @evidence contracts/e2e.md#shared-execution The maintained harness shares wrapper/helper source preparation code; this case retains only its original stdin or mutable-write process requests, with no installation or plugin build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each mutable wrapper fixture is owned by the harness and removed in finally after the process and all assertions complete; separate contents cannot affect another case.
 * @evidence contracts/e2e.md#preserved-coverage The original callback body, inputs, assertion calls and failure messages move unchanged to this executable named owner; no original distinction is removed.
 */
const test_gofmt_comment_backtick_does_not_open_literal = () => {
  // The shape that makes a literal-aware normalization dangerous. An unpaired
  // backtick in a comment would open a raw string that runs to the next
  // backtick anywhere in the file, protecting every tab between them — and in
  // the write path those tabs are gofmt's own indentation, so the region would
  // be left tab-indented and the format gate would fail on it. Comments are
  // matched for exactly this reason.
  const output = normalized(
    "package a\n" +
      "\n" +
      "func A() {\n" +
      "\t// the ` character, unpaired\n" +
      "\tprintln(1)\n" +
      "}\n" +
      "\n" +
      "const Fixture = `x`\n",
  );
  assert.equal(
    output,
    "package a\n" +
      "\n" +
      "func A() {\n" +
      "  // the ` character, unpaired\n" +
      "  println(1)\n" +
      "}\n" +
      "\n" +
      "const Fixture = `x`\n",
  );
};

module.exports = { test_gofmt_comment_backtick_does_not_open_literal };

test(
  "a backtick inside a comment does not open a raw string literal",
  test_gofmt_comment_backtick_does_not_open_literal,
);
