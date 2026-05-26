package linthost

import "testing"

// TestFunctionalNoClassesRejectsClassDeclaration verifies functional/no-classes
// rejects class declarations.
//
// Classes introduce identity and `this` state; the opt-in functional pack needs
// a direct syntax gate that does not depend on inheritance or member analysis.
//
// 1. Parse a class declaration.
// 2. Enable only functional/no-classes.
// 3. Assert the class reports and offers no autofix.
func TestFunctionalNoClassesRejectsClassDeclaration(t *testing.T) {
	const ruleName = "functional/no-classes"
	findings := runFunctionalRule(t, ruleName, `class Store { value = 1; }`)
	assertFunctionalFinding(t, ruleName, findings, "Unexpected class")
}
