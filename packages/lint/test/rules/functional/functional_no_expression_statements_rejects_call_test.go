package linthost

import "testing"

// TestFunctionalNoExpressionStatementsRejectsCall verifies functional/no-expression-statements rejects side-effect calls.
//
// Expression statements are side-effect oriented by construction. The rule
// keeps directive prologues aside and reports ordinary call statements.
//
// 1. Parse a call expression statement.
// 2. Enable only functional/no-expression-statements.
// 3. Assert the statement reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies commit() as a statement reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations A value-producing declaration avoids the forbidden side-effect statement form. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoExpressionStatementsRejectsCall is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoExpressionStatementsRejectsCall(t *testing.T) {
  const ruleName = "functional/no-expression-statements"
  findings := runFunctionalRule(t, ruleName, `commit();`)
  assertFunctionalFinding(t, ruleName, findings, "side effects")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const result = compute();"))
}
