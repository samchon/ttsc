package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeAllowMutableReturnTypeKeepsParameterAnnotation verifies allowMutableReturnType leaves parameter annotations checked.
//
// The negative twin, and the one the key's own wording depends on: parameters
// stay readonly while the return type is permitted to be mutable. A position
// test that matched any annotation on a function would erase that difference.
//
// 1. Parse a function that takes a mutable array parameter.
// 2. Enable only functional/prefer-readonly-type with `allowMutableReturnType: true`.
// 3. Assert the parameter annotation still reports.
func TestFunctionalPreferReadonlyTypeAllowMutableReturnTypeKeepsParameterAnnotation(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "function run(values: string[]): void {}",
    "{\"allowMutableReturnType\":true}",
  )
  assertFunctionalFinding(t, ruleName, findings, "readonly")
}
