const cp = require("node:child_process");

const HIGH_SEVERITIES = new Set(["high", "critical"]);

// High or critical advisories with no released fix, waived deliberately.
//
// The waiver lives here rather than in pnpm's own ignore list, and the reason is
// not that pnpm's is unreachable. Measured at the pinned pnpm 10.6.4:
// `package.json#pnpm.auditConfig.ignoreGhsas` **is** honored and does remove the
// advisory from the report's `advisories` map, while the same key in
// `pnpm-workspace.yaml` reaches nothing. But pnpm subtracts nothing from
// `metadata.vulnerabilities`, which this gate also checks, so an advisory
// ignored there disappears from the list and still fails the count with no name
// attached to explain why. Waiving here keeps one place that sees the whole
// report and says out loud what it let past.
//
// (The `[WARN] The "pnpm" field in package.json is no longer read` line that
// accompanies every command comes from the outer pnpm launcher, not from the
// 10.6.4 that `packageManager` selects and that actually runs. Do not read it as
// evidence that the field is inert.)
//
// An advisory belongs here only when **no released version fixes it**, and that
// is enforced rather than promised: a waiver applies only while the report still
// carries npm's no-fix sentinel for it. The day upstream publishes a fix, the
// advisory names its patched line, the waiver stops applying, and the gate goes
// red until someone takes the new version. Anything that already has a patched
// line goes in `pnpm.overrides` instead.
//
// Every waiver this list applied is named in the passing message, so a green run
// states what it let through instead of hiding it.
const WAIVED = new Map([
  [
    "GHSA-w3rx-r6r6-pgpr",
    "image-size ICNS parser infinite loop; vulnerable through 2.0.2, the latest published, so no override can clear it. It reaches this workspace only through @expo/metro-config, an optional peer dependency of @ttsc/metro that pnpm installs so the adapter can typecheck, and no published ttsc package depends on it. ttsc reads no images.",
  ],
  [
    "GHSA-5p2g-fcmc-qvqq",
    "image-size JXL and HEIF parser infinite loops; same package, same unpatched line, same edge as GHSA-w3rx-r6r6-pgpr.",
  ],
]);

function parseSummary(stdout) {
  const payload = JSON.parse(stdout);
  if (payload === null || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("audit payload must be an object");
  if (payload.error)
    throw new Error(
      `${String(payload.error.code ?? "audit")}: ${String(payload.error.message ?? "unknown audit error")}`,
    );
  if (
    payload.advisories === null ||
    typeof payload.advisories !== "object" ||
    Array.isArray(payload.advisories)
  )
    throw new Error("audit payload is missing its advisories map");
  const metadata = payload.metadata?.vulnerabilities;
  if (metadata === null || typeof metadata !== "object")
    throw new Error("audit payload is missing vulnerability counts");
  const counts = {};
  for (const severity of ["low", "moderate", "high", "critical"]) {
    const count = metadata[severity];
    if (!Number.isSafeInteger(count) || count < 0)
      throw new Error(`audit payload has an invalid ${severity} count`);
    counts[severity] = count;
  }
  const severe = Object.values(payload.advisories).filter((advisory) =>
    HIGH_SEVERITIES.has(advisory.severity),
  );
  const blocking = [];
  const waived = [];
  const repaired = [];
  for (const advisory of severe) {
    const id = advisoryIdentity(advisory);
    if (!WAIVED.has(id)) {
      blocking.push(id);
      continue;
    }
    if (!hasNoReleasedFix(advisory)) {
      // The waiver's own precondition stopped holding. It blocks like any other
      // advisory, and the caller says so, because "take the fix and delete the
      // entry" is a different repair from "this one has no fix".
      blocking.push(id);
      repaired.push(id);
      continue;
    }
    waived.push(id);
  }
  return {
    counts,
    ids: [...new Set(blocking)].sort(),
    // Only the waivers this report actually matched, deduplicated, so the
    // passing message names what was waived rather than what the list holds.
    waived: [...new Set(waived)].sort(),
    repaired: [...new Set(repaired)].sort(),
    // Every severe advisory the report named, waived or not. The counts are
    // compared against this rather than against the blocking set, so the two
    // aggregations stay independent: a waiver can never subtract from the
    // cross-check that catches a count with no advisory behind it.
    severeCount: severe.length,
  };
}

function advisoryIdentity(advisory) {
  return (
    advisory.github_advisory_id ??
    advisory.cves?.[0] ??
    String(advisory.id ?? advisory.module_name ?? "unknown")
  );
}

// hasNoReleasedFix reads npm's sentinel for "nothing fixes this yet".
//
// A patched range no version can satisfy is how the registry says a fix does
// not exist. Requiring it is what stops a waiver from outliving its advisory:
// nothing else in this file can tell a permanently unfixable edge from one
// somebody simply has not upgraded.
function hasNoReleasedFix(advisory) {
  return (
    typeof advisory.patched_versions === "string" &&
    advisory.patched_versions.trim() === "<0.0.0"
  );
}

function evaluateAudit(result) {
  if (result.error)
    return {
      ok: false,
      message: `dependency audit did not run: ${result.error.message}`,
    };

  let summary;
  try {
    summary = parseSummary(result.stdout ?? "");
  } catch (error) {
    return {
      ok: false,
      message:
        `dependency audit returned unreadable JSON (exit ${String(result.status)}): ` +
        `${error instanceof Error ? error.message : String(error)}\n` +
        String(result.stderr || result.stdout || ""),
    };
  }

  const counts = summary.counts;
  const label =
    `low=${counts.low}, moderate=${counts.moderate}, ` +
    `high=${counts.high}, critical=${counts.critical}` +
    (summary.waived.length === 0 ? "" : `, waived=${summary.waived.length}`);
  // pnpm 10 returns status 1 when any advisory exists even with
  // --audit-level=high, and its JSON still includes lower severities. A valid
  // payload with only low/moderate advisories therefore satisfies this gate.
  // Other statuses remain command failures.
  const unexpectedStatus = result.status !== 0 && result.status !== 1;
  // The counts are the belt to the advisory list's braces: they come from
  // pnpm's own metadata rather than from the map this gate reads, so a report
  // that counts a severe advisory it did not name still fails. The comparison
  // is against every severe advisory the report listed, waived or not, so a
  // waiver cannot weaken this half.
  const unnamed = counts.high + counts.critical - summary.severeCount;
  if (unexpectedStatus || unnamed > 0 || summary.ids.length !== 0)
    return {
      ok: false,
      message:
        `dependency audit failed (exit ${String(result.status)}; ${label})` +
        (summary.ids.length === 0
          ? ""
          : `\nblocking advisories: ${summary.ids.join(", ")}`) +
        (summary.repaired.length === 0
          ? ""
          : `\nthese now have a published fix; take it and delete the waiver from dependency-audit.cjs: ${summary.repaired.join(", ")}`) +
        (result.stderr ? `\n${result.stderr}` : ""),
    };
  return {
    ok: true,
    message:
      `dependency audit passed (${label})` +
      (summary.waived.length === 0
        ? ""
        : `\nwaived, no released fix exists: ${summary.waived.join(", ")}`),
  };
}

function runAudit() {
  const result = cp.spawnSync(
    "pnpm",
    ["audit", "--audit-level", "high", "--json"],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      shell: true,
      windowsHide: true,
    },
  );
  const outcome = evaluateAudit(result);
  const stream = outcome.ok ? process.stdout : process.stderr;
  stream.write(`${outcome.message}\n`);
  return outcome.ok ? 0 : 1;
}

module.exports = { evaluateAudit, parseSummary };

if (require.main === module) process.exit(runAudit());
