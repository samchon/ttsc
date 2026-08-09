package linthost

import "testing"

// TestFunctionalNoMixedTypesCheckTypeLiteralsFalseStillChecksInterface verifies checkTypeLiterals: false leaves interfaces checked.
//
// The twin the interface gate already had and the type-literal gate did not. The
// two keys select different container kinds, so each needs the case proving it
// does not silence the other.
//
// 1. Parse an interface that mixes a property and a method.
// 2. Enable only functional/no-mixed-types with `checkTypeLiterals: false`.
// 3. Assert the interface still reports.
func TestFunctionalNoMixedTypesCheckTypeLiteralsFalseStillChecksInterface(t *testing.T) {
  const ruleName = "functional/no-mixed-types"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "interface Mixed { value: string; run(): void; }",
    "{\"checkTypeLiterals\":false}",
  )
  assertFunctionalFinding(t, ruleName, findings, "same kind")
}
