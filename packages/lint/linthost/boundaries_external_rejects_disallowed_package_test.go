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
//
// @evidence contracts/testing.md#behavioral-verification External policy rejects @legacy/sdk/client but leaves react clean.
// @evidence contracts/testing.md#independent-expectations An explicit @legacy/sdk deny entry covers its subpath and does not cover react; literal package names establish the one finding.
// @evidence contracts/testing.md#distinguishing-cases Blocked scoped package subpath and unrelated allowed package distinguish prefix matching from all external imports.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule executes NewEngineWithResolver.Run on the authored legacy/react imports. The entry owns assertSingleBoundaryFinding and its allowed-react control.
func TestBoundariesExternalRejectsDisallowedPackage(t *testing.T) {
  const ruleName = "boundaries/external"
  source := `
    import "@legacy/sdk/client";
    import "react";
  `
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{
    "disallow": ["@legacy/sdk"]
  }`, nil)
  assertSingleBoundaryFinding(t, ruleName, findings, `@legacy/sdk/client`)
  if got := source[findings[0].Pos:findings[0].End]; got != `"@legacy/sdk/client"` {
    t.Fatalf("finding range text = %q, want %s", got, `"@legacy/sdk/client"`)
  }
}
