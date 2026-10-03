package linthost

import "testing"

// TestFunctionalNoReturnVoidRejectsVoidAnnotation verifies functional/no-return-void rejects void functions.
//
// An explicit void annotation is rejected by this configured policy. The
// empty body isolates that declaration check from return statement traversal.
//
// 1. Parse a function annotated as void.
// 2. Enable only functional/no-return-void.
// 3. Assert the function reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies void return annotation reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The policy forbids an explicit void return annotation, irrespective of whether this empty function performs a side effect. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases Positive: `function run(): void {}` must yield exactly one functional/no-return-void finding (assertFunctionalFinding). Negative control run through the same rule via assertNoFunctionalFinding: `function run(): number { return 1; }` must yield zero findings; a function declared to return number and returning a value is accepted. No option-configured variant is exercised here.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoReturnVoidRejectsVoidAnnotation is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoReturnVoidRejectsVoidAnnotation(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRule(t, ruleName, `function run(): void {}`)
  assertFunctionalFinding(t, ruleName, findings, "return")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "function run(): number { return 1; }"))
}
