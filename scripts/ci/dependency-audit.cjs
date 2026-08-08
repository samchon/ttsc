const cp = require("node:child_process");

const HIGH_SEVERITIES = new Set(["high", "critical"]);

// High or critical advisories with no released fix, waived deliberately.
//
// pnpm's own ignore list is unreachable at the pinned pnpm 10.6.4, measured
// before writing this: `package.json#pnpm.auditConfig` is warned about and
// dropped, and neither `auditConfig` nor its successor `audit.ignore` in
// `pnpm-workspace.yaml` reaches `pnpm audit`. So the waiver lives here, in the
// gate that already reads the report.
//
// An advisory belongs here only when **no released version fixes it**. Anything
// with a patched line goes in `pnpm.overrides` instead, where the audit keeps
// checking the edge rather than stopping at it. Each entry states why it is not
// exposure.
//
// Every waiver this list actually applied is named in the passing message, so a
// green run states what it waived instead of hiding it. That is the reporting
// rather than a hard failure on an unmatched entry, because a report that
// legitimately finds nothing has to stay green: turning a clean audit red is a
// worse failure mode than an entry that outlives its advisory by a release.
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
  const advisories = Object.values(payload.advisories);
  const severe = advisories
    .filter((advisory) => HIGH_SEVERITIES.has(advisory.severity))
    .map(
      (advisory) =>
        advisory.github_advisory_id ??
        advisory.cves?.[0] ??
        String(advisory.id ?? advisory.module_name ?? "unknown"),
    );
  return {
    counts,
    ids: severe.filter((id) => !WAIVED.has(id)).sort(),
    // Reported back so a waiver that no longer matches anything is a failure
    // rather than a quietly rotting comment.
    waived: [...new Set(severe.filter((id) => WAIVED.has(id)))].sort(),
  };
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
  // that counts a high advisory it did not list still fails. Only the waived
  // ones are subtracted.
  const severe = counts.high + counts.critical - summary.waived.length;
  if (unexpectedStatus || severe !== 0 || summary.ids.length !== 0)
    return {
      ok: false,
      message:
        `dependency audit failed (exit ${String(result.status)}; ${label})` +
        (summary.ids.length === 0
          ? ""
          : `\nblocking advisories: ${summary.ids.join(", ")}`) +
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
