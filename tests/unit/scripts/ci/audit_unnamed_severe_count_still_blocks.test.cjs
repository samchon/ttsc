const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks metadata counting three high findings cannot pass when only two named waiver findings account for them.
 * @evidence contracts/testing.md#independent-expectations Authored high3 and two one-finding advisory records leave an independently calculable severe remainder.
 * @evidence contracts/testing.md#distinguishing-cases Waiving every named advisory is insufficient when metadata reports another severe finding.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with a high3 count with only two named findings; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_unnamed_severe_count_still_blocks = () => {
  const outcome = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 3,
      advisories: {
        1: unfixable("GHSA-w3rx-r6r6-pgpr"),
        2: unfixable("GHSA-5p2g-fcmc-qvqq"),
      },
    }),
    stderr: "",
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /high=3/);
};

module.exports = { test_audit_unnamed_severe_count_still_blocks };

test("a severe finding the report counted but did not name still fails", test_audit_unnamed_severe_count_still_blocks);
