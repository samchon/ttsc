package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeRejectsArrayType verifies functional/prefer-readonly-type rejects mutable arrays.
//
// The rule is a type-syntax policy. A plain array type is the smallest mutable
// shape that should be replaced with readonly syntax.
//
// 1. Parse a mutable array type alias.
// 2. Enable only functional/prefer-readonly-type.
// 3. Assert the array type reports and offers no autofix.
func TestFunctionalPreferReadonlyTypeRejectsArrayType(t *testing.T) {
	const ruleName = "functional/prefer-readonly-type"
	findings := runFunctionalRule(t, ruleName, `type Values = string[];`)
	assertFunctionalFinding(t, ruleName, findings, "readonly")
}
