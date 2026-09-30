package linthost

import "testing"

// TestFunctionalNoTryStatementsRejectsTry verifies functional/no-try-statements rejects try/catch.
//
// The rule treats try statements as exceptional control flow. This pins the
// default branch where catch/finally are both disallowed.
//
// 1. Parse a try/catch statement.
// 2. Enable only functional/no-try-statements.
// 3. Assert the statement reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies try/catch statement reports; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations The policy excludes exception-oriented control statements. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoTryStatementsRejectsTry is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoTryStatementsRejectsTry(t *testing.T) {
  const ruleName = "functional/no-try-statements"
  findings := runFunctionalRule(t, ruleName, `try { run(); } catch (error) { recover(error); }`)
  assertFunctionalFinding(t, ruleName, findings, "try")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const result = run();"))
}
