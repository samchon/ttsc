package linthost

import "testing"

// TestBoundariesExternalNamesTheAllowedSet verifies that when an allow-list
// governs external dependencies, a rejected import's message names what the list
// permits.
//
// With an allow-list present, `external` rejects anything outside it and holds
// the list at the moment it reports, so the message names the permitted
// packages rather than only saying the import is forbidden.
//
// 1. Allow only `react` and `@app/*`.
// 2. Import `@legacy/sdk`, which the allow-list excludes.
// 3. Assert the finding names the allowed patterns.
//
// @evidence contracts/testing.md#behavioral-verification External rejection names react and @app/* as the allowed patterns for a denied legacy client subpath.
// @evidence contracts/testing.md#independent-expectations The literal allow list determines both rejection and the independently expected rendered Allowed here clause.
// @evidence contracts/testing.md#distinguishing-cases Only the allow-list rejection arm is exercised: the excluded @legacy/sdk/client import must name react and @app/* as permitted; the deny-only sibling owns the absence of the clause and this test has no permitted-import control.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule executes NewEngineWithResolver.Run for the external allow-list. This entry owns both assertSingleBoundaryFinding message checks on its one rejected legacy import.
func TestBoundariesExternalNamesTheAllowedSet(t *testing.T) {
  const ruleName = "boundaries/external"
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", `
    import "@legacy/sdk/client";
  `, `{
    "allow": ["react", "@app/*"]
  }`, nil)
  assertSingleBoundaryFinding(t, ruleName, findings, `External dependency "@legacy/sdk/client" is not allowed.`)
  assertSingleBoundaryFinding(t, ruleName, findings, `Allowed here: react, @app/*.`)
}
