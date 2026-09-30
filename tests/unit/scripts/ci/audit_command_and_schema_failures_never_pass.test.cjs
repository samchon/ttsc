const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateAudit } = require("../../../../scripts/ci/dependency-audit.cjs");
const { payload, unfixable } = require("./internal/audit-fixtures.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Checks spawn failure, unreadable stdout, stderr fallback, missing advisories, registry error, unexpected status2 and malformed severity counts all remain failures with useful causes.
 * @evidence contracts/testing.md#independent-expectations Independent malformed strings, absent report fields, explicit spawn/registry messages and status2 define each transport/schema rejection.
 * @evidence contracts/testing.md#distinguishing-cases Even status0 cannot make malformed JSON or empty schema green; negative, fractional, string and unsafe counts for each severity reject, and valid JSON cannot excuse unexpected command status.
 * @evidence contracts/testing.md#execution-ownership Calls the actual evaluateAudit parser and policy evaluator directly with spawn, JSON, registry, status and count-schema failures; this named callback is registered once by its file in the shared Node unit process without executing pnpm, reading a repository manifest or contacting a registry.
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

module.exports = { test_audit_command_and_schema_failures_never_pass };

test("command and JSON failures cannot report green", test_audit_command_and_schema_failures_never_pass);
