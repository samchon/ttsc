const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const {
  normalized,
  written,
  RAW_STRING_TAB,
} = require("./internal/gofmt-wrapper.cjs");

/**
 * Verifies write and stdin modes produce identical bytes.
 *
 * The raw-string fixture is written and independently formatted through stdin
 * so the repository gate and writer cannot disagree.
 *
 * 1. Exercise the unchanged formatter wrapper with the original fixture.
 * 2. Require the original observable output and failure assertions.
 *
 * @evidence contracts/testing.md#behavioral-verification Write and stdin modes produce identical bytes through the actual Go formatter and literal-aware Perl wrapper; the original assertions are retained.
 * @evidence contracts/testing.md#independent-expectations The independent stdin and write entry paths must agree; companion literal-output cases establish correctness beyond mutual agreement.
 * @evidence contracts/testing.md#distinguishing-cases The raw-string fixture is written and independently formatted through stdin so the repository gate and writer cannot disagree.
 * @evidence contracts/testing.md#execution-ownership This single named export is registered once by its physical E2E file in the shared Node formatter population; real formatter processes remain in E2E.
 * @evidence contracts/e2e.md#necessary-boundary Go output and Perl normalization are connected by the actual shell wrapper; direct calls cannot verify this process and literal-payload boundary.
 * @evidence contracts/e2e.md#shared-execution The maintained harness shares wrapper/helper source preparation code; this case retains only its original stdin or mutable-write process requests, with no installation or plugin build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each mutable wrapper fixture is owned by the harness and removed in finally after the process and all assertions complete; separate contents cannot affect another case.
 * @evidence contracts/e2e.md#preserved-coverage The original callback body, inputs, assertion calls and failure messages move unchanged to this executable named owner; no original distinction is removed.
 */
const test_gofmt_write_and_stdin_bytes_agree = () => {
  // `pnpm format` writes through one path and `scripts/ci/format-check.cjs`
  // compares against the other. If they ever disagree, the gate reports drift on
  // a tree the format command just produced.
  const result = written({ "a.go": RAW_STRING_TAB });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.after["a.go"], normalized(RAW_STRING_TAB));
};

module.exports = { test_gofmt_write_and_stdin_bytes_agree };

test(
  "the write path and the stdin path produce the same bytes",
  test_gofmt_write_and_stdin_bytes_agree,
);
