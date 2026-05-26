package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoresCodePattern verifies functional/prefer-readonly-type.
//
// Array-type diagnostics do not have a useful declaration identifier at the
// reported node. This locks the source-code pattern escape hatch for that path.
//
// 1. Parse a mutable array type alias.
// 2. Enable only functional/prefer-readonly-type with `ignoreCodePattern`.
// 3. Assert the array type is skipped.
func TestFunctionalPreferReadonlyTypeIgnoresCodePattern(t *testing.T) {
	const ruleName = "functional/prefer-readonly-type"
	findings := runFunctionalRuleWithOptions(
		t,
		ruleName,
		`type Values = string[];`,
		`{"ignoreCodePattern":"string\\[\\]"}`,
	)
	assertNoFunctionalFinding(t, ruleName, findings)
}
