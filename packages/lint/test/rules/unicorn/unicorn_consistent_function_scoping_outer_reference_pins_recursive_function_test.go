package linthost

import (
  "testing"
)

// TestUnicornConsistentFunctionScopingOuterReferencePinsRecursiveFunction retains a recursive function with an enclosing reference.
//
// The supported outer-reference constraint independently requires preserving placement when enclosing references pin the nested binding.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification Actual checker analysis distinguishes self-recursion from an additional enclosing use.
// @evidence contracts/testing.md#independent-expectations The supported outer-reference constraint independently requires preserving placement when enclosing references pin the nested binding.
// @evidence contracts/testing.md#distinguishing-cases The enclosing-reference recursive case stays clean; the identity host supplies self-recursion alone.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingOuterReferencePinsRecursiveFunction owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingOuterReferencePinsRecursiveFunction(t *testing.T) {
  // Upstream applies the parent-scope reference check before the recursive
  // function-name exemption: once the surrounding scope calls or reads the
  // recursive function directly, the definition must stay beside that use.
  source := `function outer(): void {
  function movable(value: number): number {
    return value === 0 ? 0 : movable(value - 1);
  }
  void movable;
}
void outer;
`
  assertRuleSkipsSource(t, unicornConsistentFunctionScopingRuleName, source)
}
