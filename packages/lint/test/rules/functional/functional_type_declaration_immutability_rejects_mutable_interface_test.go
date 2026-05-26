package linthost

import "testing"

// TestFunctionalTypeDeclarationImmutabilityRejectsMutableInterface verifies functional/type-declaration-immutability.
//
// Public type declarations are the policy boundary for immutable data. A mutable
// interface property should be reported even when no implementation code exists.
//
// 1. Parse an interface with a mutable property.
// 2. Enable only functional/type-declaration-immutability.
// 3. Assert the declaration reports and offers no autofix.
func TestFunctionalTypeDeclarationImmutabilityRejectsMutableInterface(t *testing.T) {
	const ruleName = "functional/type-declaration-immutability"
	findings := runFunctionalRule(t, ruleName, `interface State { values: string[]; }`)
	assertFunctionalFinding(t, ruleName, findings, "readonly")
}
