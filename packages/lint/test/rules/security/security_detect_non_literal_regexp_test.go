package linthost

import "testing"

// TestSecurityDetectNonLiteralRegexp verifies security rule: RegExp rejects dynamic patterns.
//
// Dynamic regular expression construction can let untrusted input trigger
// expensive regex evaluation, while literal patterns remain reviewable.
//
// 1. Construct RegExp from a literal.
// 2. Construct RegExp from an identifier.
// 3. Assert only the identifier constructor is reported.
//
// @evidence contracts/testing.md#behavioral-verification The detect-non-literal-regexp rule reports new RegExp(pattern) and leaves its literal anchored character pattern alone.
// @evidence contracts/testing.md#independent-expectations The independently marked constructor uses an unknown pattern; literal regex contents are not derived from the implementation and are intentionally outside this dynamic-input rule.
// @evidence contracts/testing.md#distinguishing-cases Contrasts literal and variable constructor inputs without confusing regex complexity with provenance; unsafe literal complexity is owned by TestSecurityDetectUnsafeRegex.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectNonLiteralRegexp(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-non-literal-regexp.ts", `
new RegExp("^[a-z]+$");
// expect: security/detect-non-literal-regexp error
new RegExp(pattern);
`)
}
