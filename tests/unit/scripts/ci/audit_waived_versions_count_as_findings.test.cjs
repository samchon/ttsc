const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks one waiver covering two installed versions plus a second single-version waiver accounts for high3 and passes.
 * @evidence contracts/testing.md#independent-expectations Literal findings arrays of lengths2 and1 determine three covered findings while the message counts two advisory waivers.
 * @evidence contracts/testing.md#distinguishing-cases Counting advisory objects rather than affected version findings would wrongly reject this legitimate complete coverage.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with two versions covered by one waiver; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_waived_versions_count_as_findings = () => {
  // pnpm's metadata counts findings rather than advisories, measured against
  // this repository's own report. Comparing the count against advisories would
  // have gone red here, naming nothing an author could act on.
  const outcome = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 3,
      advisories: {
        1: unfixable("GHSA-w3rx-r6r6-pgpr", 2),
        2: unfixable("GHSA-5p2g-fcmc-qvqq"),
      },
    }),
    stderr: "",
  });
  assert.equal(outcome.ok, true);
  assert.match(outcome.message, /waived=2/);
};

module.exports = { test_audit_waived_versions_count_as_findings };

test("a waived advisory reaching two versions counts as two findings", test_audit_waived_versions_count_as_findings);
