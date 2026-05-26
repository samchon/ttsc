package linthost

import "testing"

// TestFunctionalNoClassInheritanceRejectsExtends verifies
// functional/no-class-inheritance rejects `extends` clauses.
//
// The rule is narrower than functional/no-classes: projects can ban inheritance
// while still temporarily allowing class declarations during migration.
//
// 1. Parse a base class and a subclass.
// 2. Enable only functional/no-class-inheritance.
// 3. Assert the subclass inheritance reports and offers no autofix.
func TestFunctionalNoClassInheritanceRejectsExtends(t *testing.T) {
	const ruleName = "functional/no-class-inheritance"
	findings := runFunctionalRule(t, ruleName, `class Base {} class Child extends Base {}`)
	assertFunctionalFinding(t, ruleName, findings, "inheritance")
}
