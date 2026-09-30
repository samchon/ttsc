const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks a formerly waived advisory with >=2.0.3 now blocks while an adjacent still-unfixable waiver remains.
 * @evidence contracts/testing.md#independent-expectations Literal fixed patched range and distinct no-fix neighbor define the expired waiver and the required remediation diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases Known advisory identity alone cannot authorize the waiver once a patched version exists.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with a fixed known id beside a still-unfixable waiver; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_waiver_expires_when_a_fix_is_released = () => {
  const outcome = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 2,
      advisories: {
        1: {
          severity: "high",
          github_advisory_id: "GHSA-w3rx-r6r6-pgpr",
          patched_versions: ">=2.0.3",
        },
        2: unfixable("GHSA-5p2g-fcmc-qvqq"),
      },
    }),
    stderr: "",
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /blocking advisories: GHSA-w3rx-r6r6-pgpr/);
  assert.match(outcome.message, /does not hold/);
  assert.match(outcome.message, /patched_versions: >=2\.0\.3/);
};

module.exports = { test_audit_waiver_expires_when_a_fix_is_released };

test("a waiver stops applying the moment upstream publishes a fix", test_audit_waiver_expires_when_a_fix_is_released);
