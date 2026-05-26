package linthost

import "testing"

// TestSecurityDetectPossibleTimingAttacks verifies security rule: secret equality is reported.
//
// Direct equality can short-circuit in ways that leak secret-like values through
// timing, so the rule focuses on equality comparisons around sensitive names.
//
// 1. Compare a non-secret value.
// 2. Compare a password identifier.
// 3. Assert only the password comparison is reported.
func TestSecurityDetectPossibleTimingAttacks(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-possible-timing-attacks.ts", `
if (age === 5) {}
// expect: security/detect-possible-timing-attacks error
if (password === "mypass") {}
`)
}
