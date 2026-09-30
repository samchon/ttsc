const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks an unwaived critical advisory fails and reports command exit, critical count and the exact advisory identity.
 * @evidence contracts/testing.md#independent-expectations Literal critical1 and GHSA-test-test-test determine both rejection and the required diagnostic identity.
 * @evidence contracts/testing.md#distinguishing-cases An actual severe advisory must block even when the command returns the ordinary audit status1.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with an unwaived critical id and status1; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_severe_findings_block_with_identity = () => {
  const outcome = evaluateAudit({
    status: 1,
    stdout: payload({
      critical: 1,
      advisories: {
        1: {
          severity: "critical",
          github_advisory_id: "GHSA-test-test-test",
        },
      },
    }),
    stderr: "",
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /exit 1/);
  assert.match(outcome.message, /critical=1/);
  assert.match(outcome.message, /GHSA-test-test-test/);
};

module.exports = { test_audit_severe_findings_block_with_identity };

test("a nonzero audit remains red and names blocking advisories", test_audit_severe_findings_block_with_identity);
