package linthost

import "testing"

// TestFunctionalImmutableDataIgnoresCodePattern verifies functional/immutable-data honors ignoreCodePattern.
//
// The mutation rule reports member-access nodes instead of declarations, so the
// source-code pattern skip is the compatible escape hatch for generated or
// framework-owned write sites.
//
// 1. Parse a property assignment that the rule normally rejects.
// 2. Enable only functional/immutable-data with a matching `ignoreCodePattern`.
// 3. Assert the mutation is skipped.
func TestFunctionalImmutableDataIgnoresCodePattern(t *testing.T) {
	const ruleName = "functional/immutable-data"
	findings := runFunctionalRuleWithOptions(
		t,
		ruleName,
		`const state = { count: 0 }; state.count = 1;`,
		`{"ignoreCodePattern":["state\\.count"]}`,
	)
	assertNoFunctionalFinding(t, ruleName, findings)
}
