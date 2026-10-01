const assert = require("node:assert/strict");
const { test } = require("node:test");
const { normalized, RAW_STRING_TAB } = require("./internal/gofmt-wrapper.cjs");

/**
 * Verifies raw-string payload retains its literal tab.
 *
 * The literal raw-string span must retain its tab while formatting the
 * enclosing Go file.
 *
 * 1. Exercise the unchanged formatter wrapper with the original fixture.
 * 2. Require the original observable output and failure assertions.
 *
 * @evidence contracts/testing.md#behavioral-verification Raw-string payload retains its literal tab through the actual Go formatter and literal-aware Perl wrapper; the original assertions are retained.
 * @evidence contracts/testing.md#independent-expectations Literal Go inputs, expected bytes, regexes and process outcomes are preserved from the existing regression rather than derived by the new batch implementation.
 * @evidence contracts/testing.md#distinguishing-cases The literal raw-string span must retain its tab while formatting the enclosing Go file.
 * @evidence contracts/testing.md#execution-ownership This single named export is registered once by its physical E2E file in the shared Node formatter population; real formatter processes remain in E2E.
 * @evidence contracts/e2e.md#necessary-boundary Go output and Perl normalization are connected by the actual shell wrapper; direct calls cannot verify this process and literal-payload boundary.
 * @evidence contracts/e2e.md#shared-execution The maintained harness shares wrapper/helper source preparation code; this case retains only its original stdin or mutable-write process requests, with no installation or plugin build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each mutable wrapper fixture is owned by the harness and removed in finally after the process and all assertions complete; separate contents cannot affect another case.
 * @evidence contracts/e2e.md#preserved-coverage The original callback body, inputs, assertion calls and failure messages move unchanged to this executable named owner; no original distinction is removed.
 */
const test_gofmt_raw_literal_tab_survives = () => {
  const output = normalized(RAW_STRING_TAB);
  assert.match(
    output,
    /`if \(a\)\n\tx\(\);\n`/,
    "the tab a fixture asserts was rewritten into spaces",
  );
};

module.exports = { test_gofmt_raw_literal_tab_survives };

test(
  "a tab inside a raw string literal is data and survives the wrapper",
  test_gofmt_raw_literal_tab_survives,
);
