package linthost

import "testing"

// TestFunctionalNoConditionalStatementsRejectsIf verifies functional/no-conditional-statements rejects if statements.
//
// The policy prefers expression-level branching over statement-level control
// flow, so the AST-local if statement is the simplest regression target.
//
// 1. Parse an if statement.
// 2. Enable only functional/no-conditional-statements.
// 3. Assert the if statement reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies if statement reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations Expression-level branching is accepted by this statement policy. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoConditionalStatementsRejectsIf is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoConditionalStatementsRejectsIf(t *testing.T) {
  const ruleName = "functional/no-conditional-statements"
  findings := runFunctionalRule(t, ruleName, `if (flag) { run(); }`)
  assertFunctionalFinding(t, ruleName, findings, "if")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const result = flag ? left : right;"))
}
