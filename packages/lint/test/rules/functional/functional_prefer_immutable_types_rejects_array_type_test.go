package linthost

import "testing"

// TestFunctionalPreferImmutableTypesRejectsArrayType verifies functional/prefer-immutable-types rejects mutable types.
//
// Mutable array annotations are the most common type-level mutability leak. The
// rule reports the annotation without requiring checker expansion.
//
// 1. Parse a mutable array type annotation.
// 2. Enable only functional/prefer-immutable-types.
// 3. Assert the annotation reports and offers no autofix.
func TestFunctionalPreferImmutableTypesRejectsArrayType(t *testing.T) {
	const ruleName = "functional/prefer-immutable-types"
	findings := runFunctionalRule(t, ruleName, `const values: string[] = [];`)
	assertFunctionalFinding(t, ruleName, findings, "readonly")
}
