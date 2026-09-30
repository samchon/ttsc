const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks the known no-fix browser downloader advisory passes with a waiver count and explicit advisory identity.
 * @evidence contracts/testing.md#independent-expectations Authored GHSA-jmr9-qjv8-65gv no-fix report supplies the one permitted finding and exact expected visible waiver id.
 * @evidence contracts/testing.md#distinguishing-cases This downloader waiver is exercised independently of the other waiver controls so omitting this allowed id fails.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with the single downloader no-fix id; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_browser_download_waiver_is_explicit = () => {
  const outcome = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 1,
      advisories: {
        1: unfixable("GHSA-jmr9-qjv8-65gv"),
      },
    }),
    stderr: "",
  });
  assert.equal(outcome.ok, true);
  assert.match(outcome.message, /waived=1/);
  assert.match(outcome.message, /GHSA-jmr9-qjv8-65gv/);
};

module.exports = { test_audit_browser_download_waiver_is_explicit };

test("the unpatched website browser-downloader advisory is explicit", test_audit_browser_download_waiver_is_explicit);
