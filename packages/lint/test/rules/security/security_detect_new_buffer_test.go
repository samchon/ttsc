package linthost

import "testing"

// TestSecurityDetectNewBuffer verifies security rule: new Buffer rejects dynamic input.
//
// `new Buffer(nonLiteral)` is the legacy constructor shape with unsafe overloads;
// literals are left alone so migration noise stays focused.
//
// 1. Construct a Buffer from a literal.
// 2. Construct a Buffer from an identifier.
// 3. Assert only the identifier constructor is reported.
//
// @evidence contracts/testing.md#behavioral-verification The detect-new-buffer rule reports new Buffer(input) but leaves the literal constructor argument alone.
// @evidence contracts/testing.md#independent-expectations The authored expectation expresses the dynamic legacy Buffer overload policy; it is not a claim that all literal Buffer construction is recommended.
// @evidence contracts/testing.md#distinguishing-cases Contrasts literal and identifier constructor arguments. TestSecurityNameBasedNodeApiFindingsStayUntagged owns local lookalikes and diagnostic tag/range classification.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectNewBuffer(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-new-buffer.ts", `
new Buffer("safe");
// expect: security/detect-new-buffer error
new Buffer(input);
`)
}
