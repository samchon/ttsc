package linthost

import "testing"

// TestFunctionalPreferImmutableTypesIgnoresIdentifierPattern verifies functional/prefer-immutable-types.
//
// The rule reports the mutable type node, but users configure identifier
// patterns against the surrounding declaration name. This keeps that bridge
// covered for declaration-based immutable-type checks.
//
// 1. Parse a mutable array annotation on a matching variable declaration.
// 2. Enable only functional/prefer-immutable-types with `ignoreIdentifierPattern`.
// 3. Assert the type is skipped.
func TestFunctionalPreferImmutableTypesIgnoresIdentifierPattern(t *testing.T) {
	const ruleName = "functional/prefer-immutable-types"
	findings := runFunctionalRuleWithOptions(
		t,
		ruleName,
		`const mutableValues: string[] = [];`,
		`{"ignoreIdentifierPattern":"^mutableValues$"}`,
	)
	assertNoFunctionalFinding(t, ruleName, findings)
}
