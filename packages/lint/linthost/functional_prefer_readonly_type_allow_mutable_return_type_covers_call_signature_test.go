package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeAllowMutableReturnTypeCoversCallSignature verifies allowMutableReturnType covers a call signature's return type.
//
// The interface's bare call signature owns its string-array return type.
// The return exemption must recognize that annotation without disabling
// parameter annotations. This fixture observes only the call-signature
// return owner, not other signature kinds or an earlier implementation.
//
// 1. Parse an interface whose call signature returns a mutable array.
// 2. Enable only functional/prefer-readonly-type with `allowMutableReturnType: true`.
// 3. Assert the return annotation is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mutable call-signature return is accepted with allowMutableReturnType; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations Return-position exemptions also apply to interface call signatures. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases AllowMutableReturnTypeKeepsParameterAnnotation owns the unaffected parameter position.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferReadonlyTypeAllowMutableReturnTypeCoversCallSignature is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferReadonlyTypeAllowMutableReturnTypeCoversCallSignature(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "interface Factory {\n  (): string[];\n}",
    "{\"allowMutableReturnType\":true}",
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
