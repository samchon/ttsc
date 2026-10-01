package linthost

import "testing"

// TestFunctionalNoLoopStatementsRejectsFor verifies functional/no-loop-statements rejects loops.
//
// The policy expects collection transforms or recursion instead of imperative
// loops, and a for statement is the representative AST-local branch.
//
// 1. Parse a for loop.
// 2. Enable only functional/no-loop-statements.
// 3. Assert the loop reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies for-of loop reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations Collection expressions do not introduce an imperative loop statement. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoLoopStatementsRejectsFor is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoLoopStatementsRejectsFor(t *testing.T) {
  const ruleName = "functional/no-loop-statements"
  findings := runFunctionalRule(t, ruleName, `for (const item of items) { consume(item); }`)
  assertFunctionalFinding(t, ruleName, findings, "loop")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const result = items.map(consume);"))
}
