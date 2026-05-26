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
func TestFunctionalNoExpressionStatementsRejectsCall(t *testing.T) {
	const ruleName = "functional/no-expression-statements"
	findings := runFunctionalRule(t, ruleName, `commit();`)
	assertFunctionalFinding(t, ruleName, findings, "side effects")
}
