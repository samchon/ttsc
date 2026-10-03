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
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies ReadonlyArray generic reports under default keyword style; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The default style policy selects readonly T[] while preserving readonly meaning. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The positive case `type Values = ReadonlyArray<string>;` must report once with a message naming the readonly keyword, and the adjacent negative case `type Values = readonly string[];` must produce zero findings; the `prefer: "generic"` direction is not exercised here.
// @evidence contracts/testing.md#execution-ownership TestFunctionalReadonlyTypeRejectsReadonlyArrayGeneric is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalReadonlyTypeRejectsReadonlyArrayGeneric(t *testing.T) {
  const ruleName = "functional/readonly-type"
  findings := runFunctionalRule(t, ruleName, `type Values = ReadonlyArray<string>;`)
  assertFunctionalFinding(t, ruleName, findings, "readonly keyword")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "type Values = readonly string[];"))
}
