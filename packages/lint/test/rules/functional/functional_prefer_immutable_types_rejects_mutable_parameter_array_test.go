package linthost

import "testing"

// TestFunctionalPreferImmutableTypesRejectsMutableParameterArray verifies
// functional/prefer-immutable-types rejects mutable parameter array types.
//
// This checker-free subset focuses on declared types whose syntax is clearly
// mutable, giving projects a reliable migration gate without type services.
//
// 1. Parse a function parameter typed as `string[]`.
// 2. Enable only functional/prefer-immutable-types.
// 3. Assert the mutable array type reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies mutable parameter array annotation reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The parameter contract requires a readonly array annotation. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferImmutableTypesRejectsMutableParameterArray is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferImmutableTypesRejectsMutableParameterArray(t *testing.T) {
  const ruleName = "functional/prefer-immutable-types"
  findings := runFunctionalRule(t, ruleName, `function read(values: string[]) { return values.length; }`)
  assertFunctionalFinding(t, ruleName, findings, "readonly")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "function read(values: readonly string[]) { return values.length; }"))
}
