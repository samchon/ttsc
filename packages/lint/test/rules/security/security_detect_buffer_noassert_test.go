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
//
// @evidence contracts/testing.md#behavioral-verification The detect-buffer-noassert rule reports readDoubleLE with true in its legacy noAssert slot and leaves false alone.
// @evidence contracts/testing.md#independent-expectations The fixture marks only the true noAssert call; disabling bounds checks is the supported forbidden operation. Exact rule, severity and line expectations are read from authored markers.
// @evidence contracts/testing.md#distinguishing-cases The calls differ only in false versus true, distinguishing the dangerous argument from merely using a Buffer read method. Other method signatures are outside this case.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectBufferNoassert(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-buffer-noassert.ts", `
const buffer = Buffer.alloc(8);
buffer.readDoubleLE(0, false);
// expect: security/detect-buffer-noassert error
buffer.readDoubleLE(0, true);
`)
}
