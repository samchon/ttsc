package linthost

import "testing"

// TestSecurityDetectBufferNoassert verifies security rule: buffer noAssert is rejected.
//
// The rule reads the legacy Buffer read/write signature shape where the dangerous flag
// appears at different argument positions depending on the method family.
//
// 1. Call a read method with `noAssert` set to true.
// 2. Enable only `security/detect-buffer-noassert`.
// 3. Assert the call is reported.
func TestSecurityDetectBufferNoassert(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-buffer-noassert.ts", `
const buffer = Buffer.alloc(8);
buffer.readDoubleLE(0, false);
// expect: security/detect-buffer-noassert error
buffer.readDoubleLE(0, true);
`)
}
