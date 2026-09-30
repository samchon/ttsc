const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks a single observed waived id succeeds without reporting the absent second waiver id.
 * @evidence contracts/testing.md#independent-expectations Only GHSA-w3rx-r6r6-pgpr appears in the authored report, so the literal waiver count1 and absence of the other id are independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases A configured exception matching no reported advisory must not inflate the count or diagnostic list.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with one observed waiver without the other configured id; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_unseen_waiver_is_not_reported = () => {
  const outcome = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 1,
      advisories: { 1: unfixable("GHSA-w3rx-r6r6-pgpr") },
    }),
    stderr: "",
  });
  assert.equal(outcome.ok, true);
  assert.match(outcome.message, /waived=1/);
  assert.match(outcome.message, /GHSA-w3rx-r6r6-pgpr/);
  assert.doesNotMatch(outcome.message, /GHSA-5p2g-fcmc-qvqq/);
};

module.exports = { test_audit_unseen_waiver_is_not_reported };

test("an absent waiver is not reported beside an observed waiver", test_audit_unseen_waiver_is_not_reported);
