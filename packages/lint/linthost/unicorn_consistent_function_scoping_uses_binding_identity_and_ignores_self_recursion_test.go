package linthost

import (
  "testing"
)

// TestUnicornConsistentFunctionScopingUsesBindingIdentityAndIgnoresSelfRecursion distinguishes outer binding captures from self-recursion.
//
// Self-recursion is not an enclosing dependency, unlike parameter/local/type/block captures; these authored lexical relations independently determine the expected counts.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification The real binding analysis compares retained captured bindings with a self-recursive function.
// @evidence contracts/testing.md#independent-expectations Self-recursion is not an enclosing dependency, unlike parameter/local/type/block captures; these authored lexical relations independently determine the expected counts.
// @evidence contracts/testing.md#distinguishing-cases Captured parameter/local/type/block inputs stay pinned while self-recursion alone permits a report.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingUsesBindingIdentityAndIgnoresSelfRecursion owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingUsesBindingIdentityAndIgnoresSelfRecursion(t *testing.T) {
  source := `function outer(captured: number): void {
  const local = captured;
  type Local = { value: number };
  function capturesParameter(): number { return captured; }
  function capturesLocal(): number { return local; }
  function capturesType(input: Local): number { return input.value; }
  function movable(value: number): number {
    return value === 0 ? 0 : movable(value - 1);
  }
  {
    const blockLocal = 1;
    function capturesBlock(): number { return blockLocal; }
    void capturesBlock;
  }
  void [capturesParameter, capturesLocal, capturesType];
}
void outer;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornConsistentFunctionScopingRuleName, findings)
  if len(findings) != 1 || findings[0].Message != "Move function 'movable' to the outer scope." {
    t.Fatalf("want only the recursive movable function, got %+v", findings)
  }
}
