const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks an allowed no-fix advisory with an empty findings array cannot account for metadata high1.
 * @evidence contracts/testing.md#independent-expectations The independently empty array covers zero versions, leaving one counted-and-unnamed severe finding.
 * @evidence contracts/testing.md#distinguishing-cases The old one-finding fallback for an empty array must not absorb an otherwise unreported severe dependency.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with an empty findings array with high1 metadata; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_empty_findings_cover_no_severe_count = () => {
  // The fallback this replaced assumed one finding per advisory, which absorbed
  // exactly one counted-but-unnamed severe finding per advisory with an empty
  // or missing array. That is the hole the cross-check exists to close.
  const outcome = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 1,
      advisories: {
        1: {
          severity: "high",
          github_advisory_id: "GHSA-w3rx-r6r6-pgpr",
          patched_versions: "<0.0.0",
          findings: [],
        },
      },
    }),
    stderr: "",
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /counted and never named/);
};

module.exports = { test_audit_empty_findings_cover_no_severe_count };

test("an advisory reporting no findings accounts for none of the count", test_audit_empty_findings_cover_no_severe_count);
