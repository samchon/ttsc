const cp = require("node:child_process");

const HIGH_SEVERITIES = new Set(["high", "critical"]);

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
  const blocking = advisories.filter((advisory) =>
    HIGH_SEVERITIES.has(advisory.severity),
  );
  return {
    counts,
    ids: blocking
      .map(
        (advisory) =>
          advisory.github_advisory_id ??
          advisory.cves?.[0] ??
          String(advisory.id ?? advisory.module_name ?? "unknown"),
      )
      .sort(),
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
    `high=${counts.high}, critical=${counts.critical}`;
  if (
    result.status !== 0 ||
    counts.high !== 0 ||
    counts.critical !== 0 ||
    summary.ids.length !== 0
  )
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
    message: `dependency audit passed (${label})`,
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
