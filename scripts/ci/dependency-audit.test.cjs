const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const { evaluateAudit } = require("./dependency-audit.cjs");

const root = path.resolve(__dirname, "..", "..");

function payload({ high = 0, critical = 0, advisories = {} } = {}) {
  return JSON.stringify({
    advisories,
    metadata: {
      vulnerabilities: { low: 8, moderate: 26, high, critical },
    },
  });
}

test("a clean successful audit passes", () => {
  assert.deepEqual(
    evaluateAudit({ status: 0, stdout: payload(), stderr: "" }),
    {
      ok: true,
      message:
        "dependency audit passed (low=8, moderate=26, high=0, critical=0)",
    },
  );
});

test("a nonzero audit remains red and names blocking advisories", () => {
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
});

test("command and JSON failures cannot report green", () => {
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
});

test("the lockfile excludes every campaign high or critical resolution", () => {
  const lockfile = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
  for (const resolution of [
    "brace-expansion@1.1.14:",
    "brace-expansion@2.1.0:",
    "brace-expansion@5.0.6:",
    "fast-uri@3.1.2:",
    "form-data@4.0.5:",
    "js-yaml@4.1.1:",
    "linkify-it@5.0.0:",
    "next@15.5.18:",
    "postcss@8.4.31:",
    "postcss@8.5.15:",
    "sharp@0.34.5:",
    "shell-quote@1.8.4:",
    "tmp@0.2.5:",
    "undici@7.25.0:",
    "vite@7.3.3:",
    "websocket-driver@0.7.4:",
  ])
    assert.doesNotMatch(
      lockfile,
      new RegExp(`^  ${resolution.replaceAll(".", "\\.")}`, "m"),
      `vulnerable resolution remains: ${resolution}`,
    );
});
