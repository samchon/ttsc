package linthost

import "testing"

// TestFunctionalNoMixedTypesCheckTypeLiteralsFalseSkipsTypeLiteral verifies functional/no-mixed-types honors checkTypeLiterals: false.
//
// The type-literal arm of the same gate. Both container kinds ship their own
// key, so both need their own witness or one can silently take the other's
// branch.
//
// 1. Parse a type literal that mixes a property and a method.
// 2. Enable only functional/no-mixed-types with `checkTypeLiterals: false`.
// 3. Assert the type literal is skipped.
func TestFunctionalNoMixedTypesCheckTypeLiteralsFalseSkipsTypeLiteral(t *testing.T) {
  const ruleName = "functional/no-mixed-types"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "type Mixed = { value: string; run(): void };",
    "{\"checkTypeLiterals\":false}",
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
