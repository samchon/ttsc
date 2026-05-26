package linthost

import "testing"

// TestFunctionalImmutableDataRejectsPropertyAssignment verifies
// functional/immutable-data rejects writes through object properties.
//
// Property assignment is the core mutation shape this policy must catch before
// broader collection helpers matter, and it is AST-local enough to enforce
// without checker state.
//
// 1. Parse an assignment to `state.count`.
// 2. Enable only functional/immutable-data.
// 3. Assert the property write reports and offers no autofix.
func TestFunctionalImmutableDataRejectsPropertyAssignment(t *testing.T) {
	const ruleName = "functional/immutable-data"
	findings := runFunctionalRule(t, ruleName, `const state = { count: 0 }; state.count = 1;`)
	assertFunctionalFinding(t, ruleName, findings, "Modifying")
}
