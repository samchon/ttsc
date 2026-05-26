package linthost

import "testing"

// TestSecurityDetectPseudoRandomBytes verifies security rule: pseudoRandomBytes is reported.
//
// The property is dangerous even before the call expression is formed because it
// selects a weaker crypto API than `randomBytes`.
//
// 1. Read `crypto.randomBytes`.
// 2. Read `crypto.pseudoRandomBytes`.
// 3. Assert only the pseudo-random API is reported.
func TestSecurityDetectPseudoRandomBytes(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-pseudoRandomBytes.ts", `
crypto.randomBytes;
// expect: security/detect-pseudoRandomBytes error
crypto.pseudoRandomBytes;
`)
}
