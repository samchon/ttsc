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
func TestFunctionalNoThrowStatementsRejectsThrow(t *testing.T) {
	const ruleName = "functional/no-throw-statements"
	findings := runFunctionalRule(t, ruleName, `throw new Error("boom");`)
	assertFunctionalFinding(t, ruleName, findings, "throw")
}
