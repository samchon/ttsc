package linthost

import "testing"

// TestFunctionalPreferTacitRejectsTrivialWrapper verifies functional/prefer-tacit
// rejects an arrow function that only forwards its parameter.
//
// The native subset intentionally covers the safest wrapper shape first:
// `x => f(x)` has no extra logic and is easy to identify from source text.
//
// 1. Parse an arrow function that calls another function with the same parameter.
// 2. Enable only functional/prefer-tacit.
// 3. Assert the wrapper reports and offers no autofix.
func TestFunctionalPreferTacitRejectsTrivialWrapper(t *testing.T) {
	const ruleName = "functional/prefer-tacit"
	findings := runFunctionalRule(t, ruleName, `const map = (value) => transform(value);`)
	assertFunctionalFinding(t, ruleName, findings, "Potentially")
}
