package linthost

import "testing"

// TestFunctionalReadonlyTypeRejectsReadonlyArrayGeneric verifies functional/readonly-type prefers keyword form.
//
// The default option favors `readonly T[]` over `ReadonlyArray<T>`. This keeps
// the option-decoding branch separate from mutable-type detection.
//
// 1. Parse a ReadonlyArray type alias.
// 2. Enable only functional/readonly-type.
// 3. Assert the generic type reports and offers no autofix.
func TestFunctionalReadonlyTypeRejectsReadonlyArrayGeneric(t *testing.T) {
	const ruleName = "functional/readonly-type"
	findings := runFunctionalRule(t, ruleName, `type Values = ReadonlyArray<string>;`)
	assertFunctionalFinding(t, ruleName, findings, "readonly keyword")
}
