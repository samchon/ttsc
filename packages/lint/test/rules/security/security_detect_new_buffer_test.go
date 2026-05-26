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
func TestSecurityDetectNewBuffer(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-new-buffer.ts", `
new Buffer("safe");
// expect: security/detect-new-buffer error
new Buffer(input);
`)
}
