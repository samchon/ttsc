package linthost

import "testing"

// TestFunctionalNoTryStatementsRejectsTry verifies functional/no-try-statements rejects try/catch.
//
// The rule treats try statements as exceptional control flow. This pins the
// default catch-rejection branch; this input contains no finally block.
//
// 1. Parse a try/catch statement.
// 2. Enable only functional/no-try-statements.
// 3. Assert the statement reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies try/catch statement reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The policy excludes exception-oriented control statements. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases Positive: `try { run(); } catch (error) { recover(error); }` must yield exactly one functional/no-try-statements finding (assertFunctionalFinding). Negative control run through the same rule via assertNoFunctionalFinding: `const result = run();` must yield zero findings; a plain call without try is accepted. No option-configured variant is exercised here.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoTryStatementsRejectsTry is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoTryStatementsRejectsTry(t *testing.T) {
  const ruleName = "functional/no-try-statements"
  findings := runFunctionalRule(t, ruleName, `try { run(); } catch (error) { recover(error); }`)
  assertFunctionalFinding(t, ruleName, findings, "try")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const result = run();"))
}
