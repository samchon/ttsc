package linthost

import "testing"

// TestFunctionalPreferImmutableTypesRejectsMutableParameterArray verifies
// functional/prefer-immutable-types rejects mutable parameter array types.
//
// This checker-free subset focuses on declared types whose syntax is clearly
// mutable, giving projects a reliable migration gate without type services.
//
// 1. Parse a function parameter typed as `string[]`.
// 2. Enable only functional/prefer-immutable-types.
// 3. Assert the mutable array type reports and offers no autofix.
func TestFunctionalPreferImmutableTypesRejectsMutableParameterArray(t *testing.T) {
	const ruleName = "functional/prefer-immutable-types"
	findings := runFunctionalRule(t, ruleName, `function read(values: string[]) { return values.length; }`)
	assertFunctionalFinding(t, ruleName, findings, "readonly")
}
