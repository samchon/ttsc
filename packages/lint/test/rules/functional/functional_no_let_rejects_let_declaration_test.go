package linthost

import "testing"

// TestFunctionalNoLetRejectsLetDeclaration verifies functional/no-let rejects
// mutable `let` declarations.
//
// Existing `prefer-const` only catches lets that are never reassigned. The
// functional policy intentionally rejects the declaration form itself.
//
// 1. Parse a `let` declaration.
// 2. Enable only functional/no-let.
// 3. Assert the `let` keyword reports and offers no autofix.
func TestFunctionalNoLetRejectsLetDeclaration(t *testing.T) {
	const ruleName = "functional/no-let"
	findings := runFunctionalRule(t, ruleName, `let value = 1; value = 2;`)
	assertFunctionalFinding(t, ruleName, findings, "Unexpected let")
}
