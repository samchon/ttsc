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
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mutable function parameter reports with return exemption enabled; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The option exempts returns only, not every annotation in a function. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases AllowMutableReturnTypeSkipsReturnAnnotation owns the accepted return position.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferReadonlyTypeAllowMutableReturnTypeKeepsParameterAnnotation is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
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
