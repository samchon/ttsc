const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { goDrift } = require("../../../../../../scripts/ci/format-check.cjs");
const { workspace } = require("./internal/gofmt-wrapper.cjs");

/**
 * Verifies custom shell selection keeps the actual formatter's behavior.
 *
 * 1. Select a shell formatter that adds a literal comment after real gofmt.
 * 2. Require the check to detect that output without changing the source.
 * 3. Check an empty population without executing the custom formatter.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual Bash selection through BASH_ENV changes formatting output; goDrift must report the custom formatter's observable difference.
 * @evidence contracts/testing.md#independent-expectations The fixture command appends a known literal comment, which independently makes the otherwise clean source differ.
 * @evidence contracts/testing.md#distinguishing-cases A custom shell function differs from the normal SDK executable; the empty population requires no producer and returns no drift.
 * @evidence contracts/testing.md#execution-ownership This physical E2E file registers its named exported case once in the shared Node formatter population.
 * @evidence contracts/e2e.md#necessary-boundary The test exercises real shell command selection and process output, which a mocked SDK path comparison cannot establish.
 * @evidence contracts/e2e.md#shared-execution One fixture and formatter request cover command selection; the empty input needs no second producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity BASH_ENV is restored on every exit and its owned script/source directory is removed after the child returns.
 * @evidence contracts/e2e.md#preserved-coverage The normal SDK batch and original wrapper cases remain; this adds the independently selected formatter compatibility boundary.
 */
const test_gofmt_check_preserves_shell_selection = () => {
  const directory = workspace();
  const previous = process.env.BASH_ENV;
  try {
    const source = path.join(directory, "clean.go");
    const environment = path.join(directory, "environment.sh");
    fs.writeFileSync(source, "package a\n");
    fs.writeFileSync(
      environment,
      'gofmt() { command gofmt "$@"; printf "// selected formatter\\n"; }\nexport -f gofmt\n',
    );
    process.env.BASH_ENV = environment;
    assert.deepEqual(goDrift([source]), [source]);
    assert.equal(fs.readFileSync(source, "utf8"), "package a\n");
    assert.deepEqual(goDrift([]), []);
  } finally {
    if (previous === undefined) delete process.env.BASH_ENV;
    else process.env.BASH_ENV = previous;
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

module.exports = { test_gofmt_check_preserves_shell_selection };

test(
  "an independently selected shell formatter keeps its observable formatting",
  test_gofmt_check_preserves_shell_selection,
);
