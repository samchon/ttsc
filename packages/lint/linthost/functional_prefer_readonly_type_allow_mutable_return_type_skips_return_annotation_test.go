package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeAllowMutableReturnTypeSkipsReturnAnnotation verifies functional/prefer-readonly-type honors allowMutableReturnType.
//
// The option exempts this function's declared mutable array return type.
// The authored body returns a fresh array, while parameter positions
// remain checked by the separately owned reporting twin.
//
// 1. Parse a function whose declared return type is a mutable array.
// 2. Enable only functional/prefer-readonly-type with `allowMutableReturnType: true`.
// 3. Assert the return annotation is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mutable declared function return is accepted with the return exemption; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations The function may hand back a mutable value while parameters remain readonly. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases AllowMutableReturnTypeKeepsParameterAnnotation owns the unaffected parameter.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferReadonlyTypeAllowMutableReturnTypeSkipsReturnAnnotation is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
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
