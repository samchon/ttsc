package linthost

import "testing"

// TestBoundariesExternalRejectsDisallowedPackage verifies boundaries/external
// rejects a configured package name while leaving unrelated external imports
// alone.
//
// External boundaries are package/specifier policies, not source-path policies.
// This keeps the rule useful for platform or framework bans without requiring a
// local element graph to exist first.
//
// 1. Parse a file importing two external packages.
// 2. Configure only @legacy/sdk as a disallowed external dependency.
// 3. Assert the @legacy/sdk subpath import reports exactly one finding.
func TestBoundariesExternalRejectsDisallowedPackage(t *testing.T) {
	const ruleName = "boundaries/external"
	findings := runBoundaryRule(t, ruleName, "src/app/main.ts", `
    import "@legacy/sdk/client";
    import "react";
  `, `{
    "disallow": ["@legacy/sdk"]
  }`, nil)
	assertSingleBoundaryFinding(t, ruleName, findings, `@legacy/sdk/client`)
}
