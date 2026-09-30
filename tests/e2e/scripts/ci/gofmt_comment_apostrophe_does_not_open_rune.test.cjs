const assert = require("node:assert/strict");
const { test } = require("node:test");
const { normalized } = require("./internal/gofmt-wrapper.cjs");

/**
 * Verifies comment apostrophes cannot protect a comment tab.
 *
 * The tab between two apostrophes must normalize along with surrounding
 * indentation.
 *
 * 1. Exercise the unchanged formatter wrapper with the original fixture.
 * 2. Require the original observable output and failure assertions.
 *
 * @evidence contracts/testing.md#behavioral-verification Comment apostrophes cannot protect a comment tab through the actual Go formatter and literal-aware Perl wrapper; the original assertions are retained.
 * @evidence contracts/testing.md#independent-expectations Literal Go inputs, expected bytes, regexes and process outcomes are preserved from the existing regression rather than derived by the new batch implementation.
 * @evidence contracts/testing.md#distinguishing-cases The tab between two apostrophes must normalize along with surrounding indentation.
 * @evidence contracts/testing.md#execution-ownership This single named export is registered once by its physical E2E file in the shared Node formatter population; real formatter processes remain in E2E.
 * @evidence contracts/e2e.md#necessary-boundary Go output and Perl normalization are connected by the actual shell wrapper; direct calls cannot verify this process and literal-payload boundary.
 * @evidence contracts/e2e.md#shared-execution The maintained harness shares wrapper/helper source preparation code; this case retains only its original stdin or mutable-write process requests, with no installation or plugin build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each mutable wrapper fixture is owned by the harness and removed in finally after the process and all assertions complete; separate contents cannot affect another case.
 * @evidence contracts/e2e.md#preserved-coverage The original callback body, inputs, assertion calls and failure messages move unchanged to this executable named owner; no original distinction is removed.
 */
const test_gofmt_comment_apostrophe_does_not_open_rune = () => {
  // The tab sits BETWEEN the two apostrophes, which is the only position that
  // discriminates. A rune-literal arm cannot cross a newline, so a mis-lexed
  // `'t  it'` span protects exactly that one line; with no tab inside the span
  // this case passes against an implementation that matches no comment at all.
  const output = normalized(
    "package a\n\nfunc A() {\n\t// don't\tit's a comment\n\tprintln(1)\n}\n",
  );
  assert.equal(
    output,
    "package a\n\nfunc A() {\n  // don't  it's a comment\n  println(1)\n}\n",
  );
};

module.exports = { test_gofmt_comment_apostrophe_does_not_open_rune };

test(
  "an apostrophe inside a comment does not open a rune literal",
  test_gofmt_comment_apostrophe_does_not_open_rune,
);
