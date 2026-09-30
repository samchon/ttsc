const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks both downloader waiver ids remain allowed only before either advisory gains a released patched version.
 * @evidence contracts/testing.md#independent-expectations Each independently authored >=2.0.2 mutation names exactly the id that must block; both no-fix entries are the success control.
 * @evidence contracts/testing.md#distinguishing-cases The loop changes each id separately and requires one surviving waiver plus exact blocking identity, catching a combined all-or-nothing exception.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with each independently patched downloader id; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_browser_waivers_expire_independently = () => {
  const ids = ["GHSA-jmr9-qjv8-65gv", "GHSA-7pqw-9j4j-h8q3"];
  for (const fixed of [undefined, ...ids]) {
    const advisories = Object.fromEntries(
      ids.map((id, index) => [
        index,
        {
          ...unfixable(id),
          ...(id === fixed ? { patched_versions: ">=2.0.2" } : {}),
        },
      ]),
    );
    const outcome = evaluateAudit({
      status: 1,
      stdout: payload({ high: 2, advisories }),
      stderr: "",
    });
    assert.equal(outcome.ok, fixed === undefined);
    if (fixed === undefined) {
      assert.match(outcome.message, /waived=2/);
      for (const id of ids) assert.ok(outcome.message.includes(id));
    } else {
      assert.ok(outcome.message.includes(`blocking advisories: ${fixed}`));
      assert.match(outcome.message, /waived=1/);
      assert.match(outcome.message, /does not hold/);
    }
  }
};

module.exports = { test_audit_browser_waivers_expire_independently };

test("both browser-downloader waivers expire independently when a fix appears", test_audit_browser_waivers_expire_independently);
