const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks two recognized unfixable advisories pass alone but an adjacent unwaived high advisory still blocks and is named.
 * @evidence contracts/testing.md#independent-expectations Two literal waiver ids with npm no-fix sentinel and an independent GHSA-real-real-real supply the positive/negative expectations.
 * @evidence contracts/testing.md#distinguishing-cases The only changed decision input is the neighboring third severe advisory; waived ids must not appear as blocking ones.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with two no-fix waivers with and without an unwaived neighbor; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_waivers_never_hide_an_unwaived_neighbor = () => {
  const waivedOnly = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 2,
      advisories: {
        1: unfixable("GHSA-w3rx-r6r6-pgpr"),
        2: unfixable("GHSA-5p2g-fcmc-qvqq"),
      },
    }),
    stderr: "",
  });
  assert.equal(waivedOnly.ok, true);
  assert.match(waivedOnly.message, /waived=2/);
  assert.match(waivedOnly.message, /no released fix exists/);

  const alongsideReal = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 3,
      advisories: {
        1: unfixable("GHSA-w3rx-r6r6-pgpr"),
        2: unfixable("GHSA-5p2g-fcmc-qvqq"),
        3: { severity: "high", github_advisory_id: "GHSA-real-real-real" },
      },
    }),
    stderr: "",
  });
  assert.equal(alongsideReal.ok, false);
  assert.match(alongsideReal.message, /GHSA-real-real-real/);
  assert.doesNotMatch(alongsideReal.message, /blocking.*GHSA-w3rx-r6r6-pgpr/);
};

module.exports = { test_audit_waivers_never_hide_an_unwaived_neighbor };

test("a waived advisory passes while an unwaived one beside it still fails", test_audit_waivers_never_hide_an_unwaived_neighbor);
