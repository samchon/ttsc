package linthost

import (
  "testing"
)

// TestUnicornConsistentFunctionScopingChecksReturnedArrowChains checks both arrows using the enclosing returner scope.
//
// The upstream returned-arrow-chain policy evaluates both arrows against middleware's scope. The inner arrow captures next from the other arrow, not middleware; this policy independently requires two reports without claiming both arrows are capture-free.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification The engine requires two ordinary error diagnostics for the retained curried-arrow input.
// @evidence contracts/testing.md#independent-expectations The upstream returned-arrow-chain policy evaluates both arrows against middleware's scope. The inner arrow captures next from the other arrow, not middleware; this policy independently requires two reports without claiming both arrows are capture-free.
// @evidence contracts/testing.md#distinguishing-cases Both returned-chain reports remain; lexical capture counterparts belong to ChecksArrowLexicalEnvironment.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingChecksReturnedArrowChains owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingChecksReturnedArrowChains(t *testing.T) {
  source := `function middleware() {
  return (next: (value: string) => string) => (value: string) => next(value);
}
void middleware;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornConsistentFunctionScopingRuleName, findings)
  if len(findings) != 2 {
    t.Fatalf("both returned arrow definitions should be checked, got %+v", findings)
  }
}
