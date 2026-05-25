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
func TestSecurityDetectNonLiteralRegexp(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-non-literal-regexp.ts", `
new RegExp("^[a-z]+$");
// expect: security/detect-non-literal-regexp error
new RegExp(pattern);
`)
}
