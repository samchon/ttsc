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

test("a valid moderate-only audit passes despite pnpm's status 1", () => {
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

test("a waived advisory passes while an unwaived one beside it still fails", () => {
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
});

test("a waiver stops applying the moment upstream publishes a fix", () => {
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
});

test("a waiver whose advisory stops reporting a patched line fails readably", () => {
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
});

test("a waiver that matches nothing leaves a clean audit green", () => {
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
});

test("a severe finding the report counted but did not name still fails", () => {
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
});

test("a waived advisory reaching two versions counts as two findings", () => {
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
});

test("an advisory reporting no findings accounts for none of the count", () => {
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
});

test("a counted but unnamed severe finding says so in the message", () => {
  const outcome = evaluateAudit({
    status: 1,
    stdout: payload({
      high: 4,
      advisories: {
        1: unfixable("GHSA-w3rx-r6r6-pgpr"),
        2: unfixable("GHSA-5p2g-fcmc-qvqq"),
      },
    }),
    stderr: "",
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /counts 4 severe finding\(s\)/);
  assert.match(outcome.message, /account for 2/);
  assert.doesNotMatch(outcome.message, /blocking advisories/);
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
});

test("the lockfile excludes every campaign high or critical resolution", () => {
  const lockfile = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
  for (const resolution of [
    "brace-expansion@1.1.14:",
    "brace-expansion@2.1.0:",
    "brace-expansion@2.1.2:",
    "brace-expansion@5.0.6:",
    "fast-uri@3.1.2:",
    "form-data@4.0.5:",
    "js-yaml@4.1.1:",
    "linkify-it@5.0.0:",
    "nanoid@3.3.16:",
    "next@15.5.18:",
    "postcss@8.4.31:",
    "postcss@8.5.15:",
    "sharp@0.34.5:",
    "shell-quote@1.8.4:",
    "tmp@0.2.5:",
    "tmp@0.2.6:",
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
