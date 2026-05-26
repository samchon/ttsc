package linthost

import "testing"

// TestFunctionalNoClassesRejectsClass verifies functional/no-classes rejects class declarations.
//
// The opt-in functional policy treats classes as mutable object-oriented state
// containers, so the rule should report the declaration itself without relying
// on type checker state.
//
// 1. Parse a class declaration.
// 2. Enable only functional/no-classes.
// 3. Assert the class reports and offers no autofix.
func TestFunctionalNoClassesRejectsClass(t *testing.T) {
	const ruleName = "functional/no-classes"
	findings := runFunctionalRule(t, ruleName, `class Box {}`)
	assertFunctionalFinding(t, ruleName, findings, "class")
}
