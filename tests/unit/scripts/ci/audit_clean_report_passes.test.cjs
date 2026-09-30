const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks evaluateAudit returns the exact success result and low/moderate/high/critical summary for a valid clean report.
 * @evidence contracts/testing.md#independent-expectations Literal low8/moderate26/high0/critical0 metadata and exact message define success independently of the evaluator.
 * @evidence contracts/testing.md#distinguishing-cases Valid status0 and no severe findings are the success control for the severe, malformed and transport cases in this family.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with clean metadata and status0; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_clean_report_passes = () => {
  assert.deepEqual(
    evaluateAudit({ status: 0, stdout: payload(), stderr: "" }),
    {
      ok: true,
      message:
        "dependency audit passed (low=8, moderate=26, high=0, critical=0)",
    },
  );
};

module.exports = { test_audit_clean_report_passes };

test("a clean successful audit passes", test_audit_clean_report_passes);
