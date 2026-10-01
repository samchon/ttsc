package linthost

import "testing"

// TestFunctionalNoReturnVoidRejectsVoidAnnotation verifies functional/no-return-void rejects void functions.
//
// Void return types are side-effect oriented. This test pins the declaration
// return-type branch independent of return statement traversal.
//
// 1. Parse a function annotated as void.
// 2. Enable only functional/no-return-void.
// 3. Assert the function reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies void return annotation reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The policy forbids explicitly side-effect-only void returns. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoReturnVoidRejectsVoidAnnotation is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoReturnVoidRejectsVoidAnnotation(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRule(t, ruleName, `function run(): void {}`)
  assertFunctionalFinding(t, ruleName, findings, "return")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "function run(): number { return 1; }"))
}
