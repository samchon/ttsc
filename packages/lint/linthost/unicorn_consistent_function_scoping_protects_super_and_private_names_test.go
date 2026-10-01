package linthost

import (
  "testing"
)

// TestUnicornConsistentFunctionScopingProtectsSuperAndPrivateNames keeps class-owned captures while reporting a free function.
//
// Class-owned super and private names independently prevent lifting outside their lexical owner.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification Actual binding analysis checks retained super/private-name contexts and an ordinary free function.
// @evidence contracts/testing.md#independent-expectations Class-owned super and private names independently prevent lifting outside their lexical owner.
// @evidence contracts/testing.md#distinguishing-cases Super/private-dependent functions stay clean; the free ordinary function reports.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingProtectsSuperAndPrivateNames owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingProtectsSuperAndPrivateNames(t *testing.T) {
  source := `class Base {
  protected read(): number { return 1; }
}
class Derived extends Base {
  #value = 1;
  method(other: Derived): void {
    const capturesThis = (): number => this.#value;
    const capturesSuper = (): number => super.read();
    const capturesPrivate = (): number => other.#value;
    function movable(): number { return 1; }
    void [capturesThis, capturesSuper, capturesPrivate, movable];
  }
}
void Derived;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornConsistentFunctionScopingRuleName, findings)
  if len(findings) != 1 || findings[0].Message != "Move function 'movable' to the outer scope." {
    t.Fatalf("class lexical environment mismatch: %+v", findings)
  }
}
