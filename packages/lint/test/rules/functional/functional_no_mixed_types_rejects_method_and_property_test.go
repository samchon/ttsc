package linthost

import "testing"

// TestFunctionalNoMixedTypesRejectsMethodAndProperty verifies functional/no-mixed-types rejects mixed member shapes.
//
// The rule keeps structural type declarations uniform. A property plus a method
// is the smallest case that would otherwise mix data and behavior in one type.
//
// 1. Parse an interface with a property and method.
// 2. Enable only functional/no-mixed-types.
// 3. Assert the mixed member reports and offers no autofix.
func TestFunctionalNoMixedTypesRejectsMethodAndProperty(t *testing.T) {
	const ruleName = "functional/no-mixed-types"
	findings := runFunctionalRule(t, ruleName, `interface Mixed { value: string; run(): void; }`)
	assertFunctionalFinding(t, ruleName, findings, "same kind")
}
