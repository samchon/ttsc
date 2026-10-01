package linthost

import "testing"

// TestFunctionalNoThrowStatementsRejectsThrow verifies functional/no-throw-statements rejects throw.
//
// Throw statements are exceptional control flow. The policy reports the
// statement itself and leaves result/error modeling to user code.
//
// 1. Parse a throw statement.
// 2. Enable only functional/no-throw-statements.
// 3. Assert the statement reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies throw statement reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The policy excludes exceptional throw control flow, not an error value. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases Positive: `throw new Error("boom");` must yield exactly one functional/no-throw-statements finding (assertFunctionalFinding). Negative control run through the same rule via assertNoFunctionalFinding: `const result = { error: "boom" };` must yield zero findings; an object carrying an error value is accepted. No option-configured variant is exercised here.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoThrowStatementsRejectsThrow is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoThrowStatementsRejectsThrow(t *testing.T) {
  const ruleName = "functional/no-throw-statements"
  findings := runFunctionalRule(t, ruleName, `throw new Error("boom");`)
  assertFunctionalFinding(t, ruleName, findings, "throw")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const result = { error: \"boom\" };"))
}
