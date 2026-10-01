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

module.exports = { payload, unfixable };
