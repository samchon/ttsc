package linthost

import "testing"

// TestFunctionalNoLetIgnoresIdentifierPattern verifies functional/no-let honors ignoreIdentifierPattern.
//
// The public rule options expose identifier-pattern skips for functional rules.
// This pins the native decoder path so a configured binding-name exception does
// not still report the shared `let` keyword.
//
// 1. Parse a `let` declaration whose binding name matches the configured pattern.
// 2. Enable only functional/no-let with `ignoreIdentifierPattern`.
// 3. Assert the declaration is skipped.
func TestFunctionalNoLetIgnoresIdentifierPattern(t *testing.T) {
	const ruleName = "functional/no-let"
	findings := runFunctionalRuleWithOptions(
		t,
		ruleName,
		`let mutableValue = 1;`,
		`{"ignoreIdentifierPattern":"^mutableValue$"}`,
	)
	assertNoFunctionalFinding(t, ruleName, findings)
}
