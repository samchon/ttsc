package linthost

import "testing"

// TestBoundariesExternalNamesTheAllowedSet verifies that when an allow-list
// governs external dependencies, a rejected import's message names what the list
// permits.
//
// With an allow-list present, `external` rejects anything outside it and holds
// the list at the moment it reports — so the message names the permitted
// packages rather than only saying the import is forbidden.
//
// 1. Allow only `react` and `@app/*`.
// 2. Import `@legacy/sdk`, which the allow-list excludes.
// 3. Assert the finding names the allowed patterns.
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

// TestBoundariesExternalDenyOnlyNamesNothing is the negative twin: a deny-only
// external policy has no allowed set, so the message must not sprout one.
//
// 1. Disallow `@legacy/sdk` with no allow-list.
// 2. Import it.
// 3. Assert the finding fires and carries no allowed-set clause.
func TestBoundariesExternalDenyOnlyNamesNothing(t *testing.T) {
  const ruleName = "boundaries/external"
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", `
    import "@legacy/sdk/client";
  `, `{
    "disallow": ["@legacy/sdk"]
  }`, nil)
  assertSingleBoundaryFinding(t, ruleName, findings, `is not allowed.`)
  assertBoundaryFindingExcludes(t, ruleName, findings, "Allowed here")
}
