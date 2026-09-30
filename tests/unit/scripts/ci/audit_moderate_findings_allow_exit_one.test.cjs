const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks a valid moderate advisory remains successful despite pnpm status1 and retains the exact severity summary.
 * @evidence contracts/testing.md#independent-expectations Authored moderate-only advisory and zero high/critical counts distinguish expected policy from the command status alone.
 * @evidence contracts/testing.md#distinguishing-cases Status1 may represent moderate findings, unlike the severe and unexpected-status cases, so failing every nonzero command is detected.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with moderate advisory with status1; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_moderate_findings_allow_exit_one = () => {
  assert.deepEqual(
    evaluateAudit({
      status: 1,
      stdout: payload({
        advisories: {
          1: {
            severity: "moderate",
            github_advisory_id: "GHSA-moderate-test",
          },
        },
      }),
      stderr: "",
    }),
    {
      ok: true,
      message:
        "dependency audit passed (low=8, moderate=26, high=0, critical=0)",
    },
  );
};

module.exports = { test_audit_moderate_findings_allow_exit_one };

test("a valid moderate-only audit passes despite pnpm's status 1", test_audit_moderate_findings_allow_exit_one);
