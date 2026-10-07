package linthost

import (
  "testing"
)

// TestUnicornConsistentFunctionScopingReadsClassHeadPositionsAsLexicalEnvironment distinguishes enclosing class-head this from initializer this.
//
// Class-head expressions evaluate in the enclosing environment while initializer context differs, independently determining lexical-this dependencies.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification The engine checks computed class keys and heritage expressions against initializer counterparts.
// @evidence contracts/testing.md#independent-expectations Class-head expressions evaluate in the enclosing environment while initializer context differs, independently determining lexical-this dependencies.
// @evidence contracts/testing.md#distinguishing-cases Class-head enclosing-this uses stay pinned while the retained field-initializer counterpart can report.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingReadsClassHeadPositionsAsLexicalEnvironment owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingReadsClassHeadPositionsAsLexicalEnvironment(t *testing.T) {
  // Computed member keys and heritage expressions of a class evaluate in the
  // enclosing lexical environment, while field initializers and method bodies
  // rebind `this`. The owning rule keeps the first two arrows and reports the third.
  source := `function outer(): void {
  const capturesComputedKey = () =>
    class WithKey {
      [this.x](): void {}
    };
  const capturesHeritage = () => class WithBase extends (this.Base as new () => object) {};
  const rebindsThis = () =>
    class WithField {
      value = this;
    };
  void [capturesComputedKey, capturesHeritage, rebindsThis];
}
void outer;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornConsistentFunctionScopingRuleName, findings)
  if len(findings) != 1 ||
    findings[0].Message != "Move arrow function 'rebindsThis' to the outer scope." {
    t.Fatalf("class head position mismatch: %+v", findings)
  }
}
