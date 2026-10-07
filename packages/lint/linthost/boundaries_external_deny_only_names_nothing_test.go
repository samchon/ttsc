package linthost

import "testing"

// TestBoundariesExternalDenyOnlyNamesNothing is the negative twin: a deny-only
// external policy has no allowed set, so the message must not sprout one.
//
// 1. Disallow `@legacy/sdk` with no allow-list.
// 2. Import it.
// 3. Assert the finding fires and carries no allowed-set clause.
//
// @evidence contracts/testing.md#behavioral-verification The external rule denies the legacy package subpath without adding an allowed-set clause for a deny-only policy.
// @evidence contracts/testing.md#independent-expectations The explicit disallow legacy/sdk matches its client subpath; no allow list exists, so the independently forbidden message fragment must stay absent.
// @evidence contracts/testing.md#distinguishing-cases A package-prefix positive and output-clause negative complement TestBoundariesExternalNamesTheAllowedSet.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule executes NewEngineWithResolver.Run for the deny-only external policy. The entry owns both the rejection check and assertBoundaryFindingExcludes allowed-set omission.
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
