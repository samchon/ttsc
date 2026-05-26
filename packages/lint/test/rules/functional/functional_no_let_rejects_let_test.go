package linthost

import "testing"

// TestFunctionalNoLetRejectsLet verifies functional/no-let rejects mutable declarations.
//
// `let` is the direct mutable binding surface. This test pins the keyword range
// path used by the diagnostic so future parser changes do not silently skip it.
//
// 1. Parse a let declaration.
// 2. Enable only functional/no-let.
// 3. Assert the declaration reports and offers no autofix.
func TestFunctionalNoLetRejectsLet(t *testing.T) {
	const ruleName = "functional/no-let"
	findings := runFunctionalRule(t, ruleName, `let value = 1;`)
	assertFunctionalFinding(t, ruleName, findings, "let")
}
