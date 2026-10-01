const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks a known advisory missing patched_versions fails with an absent-metadata explanation and without misleading fix guidance.
 * @evidence contracts/testing.md#independent-expectations The report intentionally omits the patched line; independent absence and the neighboring legitimate no-fix waiver define rejection.
 * @evidence contracts/testing.md#distinguishing-cases Unknown patch availability must not be treated as npm's explicit no-released-fix sentinel.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with a known id with missing patch metadata; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_waiver_requires_patch_metadata = () => {
  const outcome = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 2,
      advisories: {
        1: { severity: "high", github_advisory_id: "GHSA-w3rx-r6r6-pgpr" },
        2: unfixable("GHSA-5p2g-fcmc-qvqq"),
      },
    }),
    stderr: "",
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /patched_versions: absent/);
  assert.doesNotMatch(outcome.message, /take it and delete/);
};

module.exports = { test_audit_waiver_requires_patch_metadata };

test("a waiver whose advisory stops reporting a patched line fails readably", test_audit_waiver_requires_patch_metadata);
