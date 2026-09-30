package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeRejectsArrayType verifies functional/prefer-readonly-type rejects mutable arrays.
//
// The rule is a type-syntax policy. A plain array type is the smallest mutable
// shape that should be replaced with readonly syntax.
//
// 1. Parse a mutable array type alias.
// 2. Enable only functional/prefer-readonly-type.
// 3. Assert the array type reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies mutable string[] alias reports; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations readonly keyword syntax gives the accepted immutable array form. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferReadonlyTypeRejectsArrayType is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferReadonlyTypeRejectsArrayType(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRule(t, ruleName, `type Values = string[];`)
  assertFunctionalFinding(t, ruleName, findings, "readonly")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "type Values = readonly string[];"))
}
