package linthost

import (
  "testing"
)

// TestUnicornConsistentFunctionScopingTreatsLoopScopesAsOneBoundary keeps loop header and body captures within their lifetime.
//
// Loop binding lifetimes independently prevent lifting a dependent function beyond that lexical boundary.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification The checker evaluates retained loop header/body dependencies and capture-free functions.
// @evidence contracts/testing.md#independent-expectations Loop binding lifetimes independently prevent lifting a dependent function beyond that lexical boundary.
// @evidence contracts/testing.md#distinguishing-cases Header/body captures stay pinned while free functions report within original loop forms.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingTreatsLoopScopesAsOneBoundary owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingTreatsLoopScopesAsOneBoundary(t *testing.T) {
  source := `declare const values: readonly number[];
function outer(): void {
  for (const value of values) {
    const local = value;
    const capturesHeader = (): number => value;
    const capturesBody = (): number => local;
    const movable = (): boolean => true;
    void [capturesHeader, capturesBody, movable];
  }
}
void outer;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornConsistentFunctionScopingRuleName, findings)
  if len(findings) != 1 || findings[0].Message != "Move arrow function 'movable' to the outer scope." {
    t.Fatalf("loop scope analysis mismatch: %+v", findings)
  }
}
