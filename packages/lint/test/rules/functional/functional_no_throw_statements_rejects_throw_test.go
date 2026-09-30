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
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies throw statement reports; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations The policy excludes exceptional throw control flow, not an error value. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoThrowStatementsRejectsThrow is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoThrowStatementsRejectsThrow(t *testing.T) {
  const ruleName = "functional/no-throw-statements"
  findings := runFunctionalRule(t, ruleName, `throw new Error("boom");`)
  assertFunctionalFinding(t, ruleName, findings, "throw")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const result = { error: \"boom\" };"))
}
