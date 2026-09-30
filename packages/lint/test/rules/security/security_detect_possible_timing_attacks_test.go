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
//
// @evidence contracts/testing.md#behavioral-verification The timing rule reports equality involving password while leaving equality involving age alone.
// @evidence contracts/testing.md#independent-expectations The authored names deliberately encode the supported sensitive-name heuristic; this test does not prove timing behavior or semantic secret provenance.
// @evidence contracts/testing.md#distinguishing-cases Same equality syntax with nonsensitive and password identifiers detects indiscriminate comparison reporting; it documents the heuristic limit rather than certifying cryptographic safety.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectPossibleTimingAttacks(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-possible-timing-attacks.ts", `
if (age === 5) {}
// expect: security/detect-possible-timing-attacks error
if (password === "mypass") {}
`)
}
