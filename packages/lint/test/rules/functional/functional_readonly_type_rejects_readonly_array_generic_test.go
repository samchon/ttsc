package linthost

import "testing"

// TestFunctionalReadonlyTypeRejectsReadonlyArrayGeneric verifies functional/readonly-type prefers keyword form.
//
// The default option favors `readonly T[]` over `ReadonlyArray<T>`. This keeps
// the option-decoding branch separate from mutable-type detection.
//
// 1. Parse a ReadonlyArray type alias.
// 2. Enable only functional/readonly-type.
// 3. Assert the generic type reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies ReadonlyArray generic reports under default keyword style; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations The default style policy selects readonly T[] while preserving readonly meaning. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalReadonlyTypeRejectsReadonlyArrayGeneric is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalReadonlyTypeRejectsReadonlyArrayGeneric(t *testing.T) {
  const ruleName = "functional/readonly-type"
  findings := runFunctionalRule(t, ruleName, `type Values = ReadonlyArray<string>;`)
  assertFunctionalFinding(t, ruleName, findings, "readonly keyword")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "type Values = readonly string[];"))
}
