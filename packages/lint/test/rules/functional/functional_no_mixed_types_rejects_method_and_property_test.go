package linthost

import "testing"

// TestFunctionalNoMixedTypesRejectsMethodAndProperty verifies functional/no-mixed-types rejects mixed member shapes.
//
// The rule keeps structural type declarations uniform. A property plus a method
// is the smallest case that would otherwise mix data and behavior in one type.
//
// 1. Parse an interface with a property and method.
// 2. Enable only functional/no-mixed-types.
// 3. Assert the mixed member reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies mixed property and method interface reports; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations The policy requires uniform member kinds. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoMixedTypesRejectsMethodAndProperty is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoMixedTypesRejectsMethodAndProperty(t *testing.T) {
  const ruleName = "functional/no-mixed-types"
  findings := runFunctionalRule(t, ruleName, `interface Mixed { value: string; run(): void; }`)
  assertFunctionalFinding(t, ruleName, findings, "same kind")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "interface Data { value: string; label: string; }"))
}
