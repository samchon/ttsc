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
func TestFunctionalNoLoopStatementsRejectsFor(t *testing.T) {
	const ruleName = "functional/no-loop-statements"
	findings := runFunctionalRule(t, ruleName, `for (const item of items) { consume(item); }`)
	assertFunctionalFinding(t, ruleName, findings, "loop")
}
