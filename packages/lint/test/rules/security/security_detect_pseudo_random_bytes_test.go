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
//
// @evidence contracts/testing.md#behavioral-verification The pseudoRandomBytes rule reports the weak crypto property read while leaving randomBytes alone.
// @evidence contracts/testing.md#independent-expectations Literal property names follow the supported stronger versus weaker API policy; the expectation is authored before the engine runs.
// @evidence contracts/testing.md#distinguishing-cases Neighboring crypto properties differ only in API name, and reporting at property access does not require a call. The tag/range sibling owns local crypto lookalikes.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectPseudoRandomBytes(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-pseudoRandomBytes.ts", `
crypto.randomBytes;
// expect: security/detect-pseudoRandomBytes error
crypto.pseudoRandomBytes;
`)
}
