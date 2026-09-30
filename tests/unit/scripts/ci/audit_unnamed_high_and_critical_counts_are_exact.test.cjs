const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks counted-but-unnamed severe failure includes the exact high-plus-critical total, accounted findings and remainder without fabricated advisory ids.
 * @evidence contracts/testing.md#independent-expectations Literal high3 plus critical2 gives5 total, two one-finding waivers give2 accounted and3 unnamed.
 * @evidence contracts/testing.md#distinguishing-cases Both severity categories must contribute; dropping critical findings or inventing blocking advisory identities fails the exact summary.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with independent high and critical count totals; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_unnamed_high_and_critical_counts_are_exact = () => {
  // `critical` is in the fixture as well as `high`, because the message adds
  // the two and an assertion reading only `high` would let the sum silently
  // stop counting critical findings.
  const outcome = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 3,
      critical: 2,
      advisories: {
        1: unfixable("GHSA-w3rx-r6r6-pgpr"),
        2: unfixable("GHSA-5p2g-fcmc-qvqq"),
      },
    }),
    stderr: "",
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /counts 5 severe finding\(s\)/);
  assert.match(outcome.message, /account for 2/);
  assert.match(outcome.message, /3 were counted and never named/);
  assert.doesNotMatch(outcome.message, /blocking advisories/);
};

module.exports = { test_audit_unnamed_high_and_critical_counts_are_exact };

test("a counted but unnamed severe finding says so in the message", test_audit_unnamed_high_and_critical_counts_are_exact);
