package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeAllowMutableReturnTypeSkipsReturnAnnotation verifies functional/prefer-readonly-type honors allowMutableReturnType.
//
// The key exists so a function may hand back a fresh mutable value while its
// parameters stay readonly. It decoded nothing before #1132, so the return
// annotation reported like any other position.
//
// 1. Parse a function whose declared return type is a mutable array.
// 2. Enable only functional/prefer-readonly-type with `allowMutableReturnType: true`.
// 3. Assert the return annotation is skipped.
func TestFunctionalPreferReadonlyTypeAllowMutableReturnTypeSkipsReturnAnnotation(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "function run(): string[] { return []; }",
    "{\"allowMutableReturnType\":true}",
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
