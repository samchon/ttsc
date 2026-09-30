const assert = require("node:assert/strict");
const { test } = require("node:test");

const { evaluateAudit } = require("../../../../scripts/ci/dependency-audit.cjs");

function payload({ high = 0, critical = 0, advisories = {} } = {}) {
  return JSON.stringify({
    advisories,
    metadata: {
      vulnerabilities: { low: 8, moderate: 26, high, critical },
    },
  });
}

// `<0.0.0` is npm's sentinel for "no released version fixes this", which is the
// precondition every waiver in the gate is checked against.
const unfixable = (id, findings = 1) => ({
  severity: "high",
  github_advisory_id: id,
  patched_versions: "<0.0.0",
  findings: Array.from({ length: findings }, (_unused, index) => ({
    version: `1.0.${String(index)}`,
  })),
});

/**
 * @evidence contracts/testing.md#behavioral-verification Checks evaluateAudit returns the exact success result and low/moderate/high/critical summary for a valid clean report.
 * @evidence contracts/testing.md#independent-expectations Literal low8/moderate26/high0/critical0 metadata and exact message define success independently of the evaluator.
 * @evidence contracts/testing.md#distinguishing-cases Valid status0 and no severe findings are the success control for the severe, malformed and transport cases in this family.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with clean metadata and status0; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
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

/**
 * @evidence contracts/testing.md#behavioral-verification Checks a valid moderate advisory remains successful despite pnpm status1 and retains the exact severity summary.
 * @evidence contracts/testing.md#independent-expectations Authored moderate-only advisory and zero high/critical counts distinguish expected policy from the command status alone.
 * @evidence contracts/testing.md#distinguishing-cases Status1 may represent moderate findings, unlike the severe and unexpected-status cases, so failing every nonzero command is detected.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with moderate advisory with status1; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
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

/**
 * @evidence contracts/testing.md#behavioral-verification Checks an unwaived critical advisory fails and reports command exit, critical count and the exact advisory identity.
 * @evidence contracts/testing.md#independent-expectations Literal critical1 and GHSA-test-test-test determine both rejection and the required diagnostic identity.
 * @evidence contracts/testing.md#distinguishing-cases An actual severe advisory must block even when the command returns the ordinary audit status1.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with an unwaived critical id and status1; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
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

/**
 * @evidence contracts/testing.md#behavioral-verification Checks two recognized unfixable advisories pass alone but an adjacent unwaived high advisory still blocks and is named.
 * @evidence contracts/testing.md#independent-expectations Two literal waiver ids with npm no-fix sentinel and an independent GHSA-real-real-real supply the positive/negative expectations.
 * @evidence contracts/testing.md#distinguishing-cases The only changed decision input is the neighboring third severe advisory; waived ids must not appear as blocking ones.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with two no-fix waivers with and without an unwaived neighbor; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
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

/**
 * @evidence contracts/testing.md#behavioral-verification Checks the known no-fix browser downloader advisory passes with a waiver count and explicit advisory identity.
 * @evidence contracts/testing.md#independent-expectations Authored GHSA-jmr9-qjv8-65gv no-fix report supplies the one permitted finding and exact expected visible waiver id.
 * @evidence contracts/testing.md#distinguishing-cases This downloader waiver is exercised independently of the other waiver controls so omitting this allowed id fails.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with the single downloader no-fix id; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
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

/**
 * @evidence contracts/testing.md#behavioral-verification Checks both downloader waiver ids remain allowed only before either advisory gains a released patched version.
 * @evidence contracts/testing.md#independent-expectations Each independently authored >=2.0.2 mutation names exactly the id that must block; both no-fix entries are the success control.
 * @evidence contracts/testing.md#distinguishing-cases The loop changes each id separately and requires one surviving waiver plus exact blocking identity, catching a combined all-or-nothing exception.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with each independently patched downloader id; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
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

/**
 * @evidence contracts/testing.md#behavioral-verification Checks a formerly waived advisory with >=2.0.3 now blocks while an adjacent still-unfixable waiver remains.
 * @evidence contracts/testing.md#independent-expectations Literal fixed patched range and distinct no-fix neighbor define the expired waiver and the required remediation diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases Known advisory identity alone cannot authorize the waiver once a patched version exists.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with a fixed known id beside a still-unfixable waiver; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
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

/**
 * @evidence contracts/testing.md#behavioral-verification Checks a known advisory missing patched_versions fails with an absent-metadata explanation and without misleading fix guidance.
 * @evidence contracts/testing.md#independent-expectations The report intentionally omits the patched line; independent absence and the neighboring legitimate no-fix waiver define rejection.
 * @evidence contracts/testing.md#distinguishing-cases Unknown patch availability must not be treated as npm?s explicit no-released-fix sentinel.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with a known id with missing patch metadata; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
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

/**
 * @evidence contracts/testing.md#behavioral-verification Checks a single observed waived id succeeds without reporting the absent second waiver id.
 * @evidence contracts/testing.md#independent-expectations Only GHSA-w3rx-r6r6-pgpr appears in the authored report, so the literal waiver count1 and absence of the other id are independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases A configured exception matching no reported advisory must not inflate the count or diagnostic list.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with one observed waiver without the other configured id; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_unseen_waiver_is_not_reported = () => {
  const outcome = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 1,
      advisories: { 1: unfixable("GHSA-w3rx-r6r6-pgpr") },
    }),
    stderr: "",
  });
  assert.equal(outcome.ok, true);
  assert.match(outcome.message, /waived=1/);
  assert.match(outcome.message, /GHSA-w3rx-r6r6-pgpr/);
  assert.doesNotMatch(outcome.message, /GHSA-5p2g-fcmc-qvqq/);
};

/**
 * @evidence contracts/testing.md#behavioral-verification Checks metadata counting three high findings cannot pass when only two named waiver findings account for them.
 * @evidence contracts/testing.md#independent-expectations Authored high3 and two one-finding advisory records leave an independently calculable severe remainder.
 * @evidence contracts/testing.md#distinguishing-cases Waiving every named advisory is insufficient when metadata reports another severe finding.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with a high3 count with only two named findings; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_unnamed_severe_count_still_blocks = () => {
  const outcome = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 3,
      advisories: {
        1: unfixable("GHSA-w3rx-r6r6-pgpr"),
        2: unfixable("GHSA-5p2g-fcmc-qvqq"),
      },
    }),
    stderr: "",
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /high=3/);
};

/**
 * @evidence contracts/testing.md#behavioral-verification Checks one waiver covering two installed versions plus a second single-version waiver accounts for high3 and passes.
 * @evidence contracts/testing.md#independent-expectations Literal findings arrays of lengths2 and1 determine three covered findings while the message counts two advisory waivers.
 * @evidence contracts/testing.md#distinguishing-cases Counting advisory objects rather than affected version findings would wrongly reject this legitimate complete coverage.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with two versions covered by one waiver; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_waived_versions_count_as_findings = () => {
  // pnpm's metadata counts findings rather than advisories, measured against
  // this repository's own report. Comparing the count against advisories would
  // have gone red here, naming nothing an author could act on.
  const outcome = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 3,
      advisories: {
        1: unfixable("GHSA-w3rx-r6r6-pgpr", 2),
        2: unfixable("GHSA-5p2g-fcmc-qvqq"),
      },
    }),
    stderr: "",
  });
  assert.equal(outcome.ok, true);
  assert.match(outcome.message, /waived=2/);
};

/**
 * @evidence contracts/testing.md#behavioral-verification Checks an allowed no-fix advisory with an empty findings array cannot account for metadata high1.
 * @evidence contracts/testing.md#independent-expectations The independently empty array covers zero versions, leaving one counted-and-unnamed severe finding.
 * @evidence contracts/testing.md#distinguishing-cases The old one-finding fallback for an empty array must not absorb an otherwise unreported severe dependency.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with an empty findings array with high1 metadata; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
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

/**
 * @evidence contracts/testing.md#behavioral-verification Checks counted-but-unnamed severe failure includes the exact high-plus-critical total, accounted findings and remainder without fabricated advisory ids.
 * @evidence contracts/testing.md#independent-expectations Literal high3 plus critical2 gives5 total, two one-finding waivers give2 accounted and3 unnamed.
 * @evidence contracts/testing.md#distinguishing-cases Both severity categories must contribute; dropping critical findings or inventing blocking advisory identities fails the exact summary.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with independent high and critical count totals; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
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

/**
 * @evidence contracts/testing.md#behavioral-verification Checks spawn failure, unreadable stdout, stderr fallback, missing advisories, registry error, unexpected status2 and malformed severity counts all remain failures with useful causes.
 * @evidence contracts/testing.md#independent-expectations Independent malformed strings, absent report fields, explicit spawn/registry messages and status2 define each transport/schema rejection.
 * @evidence contracts/testing.md#distinguishing-cases Even status0 cannot make malformed JSON or empty schema green; negative, fractional, string and unsafe counts for each severity reject, and valid JSON cannot excuse unexpected command status.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with spawn, JSON, registry, status and count-schema failures; this callback runs once in the shared audit file without executing pnpm, reading a repository manifest or contacting a registry.
 */
const test_audit_command_and_schema_failures_never_pass = () => {
  const command = evaluateAudit({
    error: new Error("spawn failed"),
    status: null,
    stdout: "",
    stderr: "",
  });
  assert.equal(command.ok, false);
  assert.match(command.message, /did not run: spawn failed/);

  const malformed = evaluateAudit({
    status: 0,
    stdout: "not JSON",
    stderr: "registry failed",
  });
  assert.equal(malformed.ok, false);
  assert.match(malformed.message, /unreadable JSON/);
  assert.match(malformed.message, /registry failed/);

  const stdoutOnly = evaluateAudit({
    status: 1,
    stdout: "registry returned an invalid body",
    stderr: "",
  });
  assert.equal(stdoutOnly.ok, false);
  assert.match(stdoutOnly.message, /registry returned an invalid body/);

  const empty = evaluateAudit({
    status: 0,
    stdout: "{}",
    stderr: "",
  });
  assert.equal(empty.ok, false);
  assert.match(empty.message, /missing its advisories map/);

  const registry = evaluateAudit({
    status: 1,
    stdout: JSON.stringify({
      error: { code: "pnpm", message: "registry response failed" },
    }),
    stderr: "",
  });
  assert.equal(registry.ok, false);
  assert.match(registry.message, /pnpm: registry response failed/);

  const unexpectedStatus = evaluateAudit({
    status: 2,
    stdout: payload(),
    stderr: "audit command exited unexpectedly",
  });
  assert.equal(unexpectedStatus.ok, false);
  assert.match(unexpectedStatus.message, /exit 2/);
  assert.match(unexpectedStatus.message, /audit command exited unexpectedly/);
  for (const severity of ["low", "moderate", "high", "critical"]) {
    for (const invalid of [-1, 0.5, "0", Number.MAX_SAFE_INTEGER + 1]) {
      const report = JSON.parse(payload());
      report.metadata.vulnerabilities[severity] = invalid;
      const outcome = evaluateAudit({ status: 0, stdout: JSON.stringify(report), stderr: "" });
      assert.equal(outcome.ok, false, `${severity}: ${String(invalid)}`);
      assert.ok(outcome.message.includes(`invalid ${severity} count`));
    }
  }
};

module.exports = {
  test_audit_clean_report_passes,
  test_audit_moderate_findings_allow_exit_one,
  test_audit_severe_findings_block_with_identity,
  test_audit_waivers_never_hide_an_unwaived_neighbor,
  test_audit_browser_download_waiver_is_explicit,
  test_audit_browser_waivers_expire_independently,
  test_audit_waiver_expires_when_a_fix_is_released,
  test_audit_waiver_requires_patch_metadata,
  test_audit_unseen_waiver_is_not_reported,
  test_audit_unnamed_severe_count_still_blocks,
  test_audit_waived_versions_count_as_findings,
  test_audit_empty_findings_cover_no_severe_count,
  test_audit_unnamed_high_and_critical_counts_are_exact,
  test_audit_command_and_schema_failures_never_pass,
};

test("a clean successful audit passes", test_audit_clean_report_passes);

test("a valid moderate-only audit passes despite pnpm's status 1", test_audit_moderate_findings_allow_exit_one);

test("a nonzero audit remains red and names blocking advisories", test_audit_severe_findings_block_with_identity);

test("a waived advisory passes while an unwaived one beside it still fails", test_audit_waivers_never_hide_an_unwaived_neighbor);

test("the unpatched website browser-downloader advisory is explicit", test_audit_browser_download_waiver_is_explicit);

test("both browser-downloader waivers expire independently when a fix appears", test_audit_browser_waivers_expire_independently);

test("a waiver stops applying the moment upstream publishes a fix", test_audit_waiver_expires_when_a_fix_is_released);

test("a waiver whose advisory stops reporting a patched line fails readably", test_audit_waiver_requires_patch_metadata);

test("a waiver that matches nothing leaves a clean audit green", test_audit_unseen_waiver_is_not_reported);

test("a severe finding the report counted but did not name still fails", test_audit_unnamed_severe_count_still_blocks);

test("a waived advisory reaching two versions counts as two findings", test_audit_waived_versions_count_as_findings);

test("an advisory reporting no findings accounts for none of the count", test_audit_empty_findings_cover_no_severe_count);

test("a counted but unnamed severe finding says so in the message", test_audit_unnamed_high_and_critical_counts_are_exact);

test("command and JSON failures cannot report green", test_audit_command_and_schema_failures_never_pass);
