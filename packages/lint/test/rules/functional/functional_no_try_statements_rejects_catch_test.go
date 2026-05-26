package linthost

import "testing"

// TestFunctionalNoTryStatementsRejectsCatch verifies functional/no-try-statements
// rejects try/catch blocks.
//
// The exception-free policy treats try/catch as control flow. This covers the
// catch branch separately from throw detection.
//
// 1. Parse a try/catch block.
// 2. Enable only functional/no-try-statements.
// 3. Assert the try statement reports and offers no autofix.
func TestFunctionalNoTryStatementsRejectsCatch(t *testing.T) {
	const ruleName = "functional/no-try-statements"
	findings := runFunctionalRule(t, ruleName, `try { run(); } catch (error) { recover(error); }`)
	assertFunctionalFinding(t, ruleName, findings, "try-catch")
}
