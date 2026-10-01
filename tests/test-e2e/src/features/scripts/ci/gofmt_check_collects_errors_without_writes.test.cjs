const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { goDrift } = require("../../../../../../scripts/ci/format-check.cjs");
const {
  workspace,
  normalized,
  RAW_STRING_TAB,
} = require("./internal/gofmt-wrapper.cjs");

/**
 * Verifies the check retains drift and every independent read/parse failure.
 *
 * 1. Check clean and unformatted files without modifying their bytes.
 * 2. Add malformed and missing inputs and require both errors and known drift.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual goDrift reads fixture files and reports format differences plus both syntax and read errors while preserving source bytes.
 * @evidence contracts/testing.md#independent-expectations Literal valid and malformed Go inputs establish their outcomes; the existing stdin path establishes the clean literal-tab file.
 * @evidence contracts/testing.md#distinguishing-cases Clean, changed, malformed and absent inputs share one request, so an early failure cannot hide the other classifications.
 * @evidence contracts/testing.md#execution-ownership This physical E2E file registers its named exported case once in the shared Node formatter population.
 * @evidence contracts/e2e.md#necessary-boundary The real filesystem-to-Go-to-Perl check must collect file-specific errors and remain read-only; an in-process format call alone cannot establish this connection.
 * @evidence contracts/e2e.md#shared-execution Each distinct input population uses one batch; no fixture installation or per-file native producer is repeated.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity All files belong to one bounded fixture removed after assertions; input bytes are independently compared after success and failure.
 * @evidence contracts/e2e.md#preserved-coverage Existing write-path assertions remain; this adds complete failure collection and checks that optimization introduces no source writes.
 */
const test_gofmt_check_collects_errors_without_writes = () => {
  const directory = workspace();
  try {
    const good = path.join(directory, "space 한글.go");
    const bad = path.join(directory, "broken.go");
    const clean = path.join(directory, "clean.go");
    const source = "package a\n\nfunc A(){println(1)}\n";
    fs.writeFileSync(good, source);
    fs.writeFileSync(bad, "package a\nfunc broken( {");
    fs.writeFileSync(clean, normalized(RAW_STRING_TAB));
    assert.deepEqual(goDrift([good, clean]), [good]);
    assert.equal(fs.readFileSync(good, "utf8"), source);
    assert.throws(
      () => goDrift([good, bad, clean, path.join(directory, "missing.go")]),
      (error) => {
        assert.match(error.message, /broken\.go/);
        assert.match(error.message, /missing\.go/);
        assert.ok(error.message.includes(good));
        return error.errors.length === 2;
      },
    );
    assert.equal(fs.readFileSync(good, "utf8"), source);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

module.exports = { test_gofmt_check_collects_errors_without_writes };

test(
  "the read-only check reports independent drift and parse errors without rewriting files",
  test_gofmt_check_collects_errors_without_writes,
);
