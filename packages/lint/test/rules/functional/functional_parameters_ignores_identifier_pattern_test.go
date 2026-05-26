package linthost

import "testing"

// TestFunctionalParametersIgnoresIdentifierPattern verifies functional/functional-parameters.
//
// Rest-parameter diagnostics are anchored to the parameter node. This pins the
// shared identifier-pattern skip for the functional parameter option decoder.
//
// 1. Parse a rest parameter whose name matches the configured pattern.
// 2. Enable only functional/functional-parameters with `ignoreIdentifierPattern`.
// 3. Assert the parameter is skipped.
func TestFunctionalParametersIgnoresIdentifierPattern(t *testing.T) {
	const ruleName = "functional/functional-parameters"
	findings := runFunctionalRuleWithOptions(
		t,
		ruleName,
		`function collect(...items: string[]) { return items; }`,
		`{"ignoreIdentifierPattern":"^items$"}`,
	)
	assertNoFunctionalFinding(t, ruleName, findings)
}
