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
func TestFunctionalNoConditionalStatementsRejectsIf(t *testing.T) {
	const ruleName = "functional/no-conditional-statements"
	findings := runFunctionalRule(t, ruleName, `if (flag) { run(); }`)
	assertFunctionalFinding(t, ruleName, findings, "if")
}
