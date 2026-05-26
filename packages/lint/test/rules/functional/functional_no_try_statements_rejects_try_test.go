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
func TestFunctionalNoTryStatementsRejectsTry(t *testing.T) {
	const ruleName = "functional/no-try-statements"
	findings := runFunctionalRule(t, ruleName, `try { run(); } catch (error) { recover(error); }`)
	assertFunctionalFinding(t, ruleName, findings, "try")
}
