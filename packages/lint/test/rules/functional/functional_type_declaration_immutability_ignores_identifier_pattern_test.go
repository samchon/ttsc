package linthost

import "testing"

// TestFunctionalTypeDeclarationImmutabilityIgnoresIdentifierPattern verifies functional/type-declaration-immutability.
//
// Type declarations already have name-scoped `rules`; this locks the shared
// `ignoreIdentifierPattern` path layered over that local policy surface.
//
// 1. Parse a mutable interface whose name matches the configured ignore pattern.
// 2. Enable only functional/type-declaration-immutability with `ignoreIdentifierPattern`.
// 3. Assert the declaration is skipped.
func TestFunctionalTypeDeclarationImmutabilityIgnoresIdentifierPattern(t *testing.T) {
	const ruleName = "functional/type-declaration-immutability"
	findings := runFunctionalRuleWithOptions(
		t,
		ruleName,
		`interface MutableSnapshot { value: string[]; }`,
		`{"ignoreIdentifierPattern":"^MutableSnapshot$"}`,
	)
	assertNoFunctionalFinding(t, ruleName, findings)
}
