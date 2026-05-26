package linthost

import "testing"

// TestFunctionalPreferTacitRejectsSingleArgumentWrapper verifies functional/prefer-tacit rejects needless wrappers.
//
// A single-argument arrow that only forwards into another call is the safest
// point-free style candidate and avoids semantic changes from arity-sensitive functions.
//
// 1. Parse a forwarding arrow function.
// 2. Enable only functional/prefer-tacit.
// 3. Assert the arrow reports and offers no autofix.
func TestFunctionalPreferTacitRejectsSingleArgumentWrapper(t *testing.T) {
	const ruleName = "functional/prefer-tacit"
	findings := runFunctionalRule(t, ruleName, `const parse = (value) => Number(value);`)
	assertFunctionalFinding(t, ruleName, findings, "wrapper")
}
