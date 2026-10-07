package linthost

import "testing"

// TestFormatPrintWidthHonorsCRLFEndOfLine verifies the `endOfLine:
// "crlf"` option threads CRLF terminators through every newline the
// reflow emits.
//
// Projects with mixed editor populations or Windows-origin tooling
// rely on `endOfLine` to preserve their conventions. A regression
// that hard-coded LF would silently rewrite CRLF terminators on every
// `ttsc format` pass.
//
//  1. Configure printWidth=20, endOfLine="crlf".
//  2. Feed `const x = { aa: 1, bb: 2, cc: 3 };`.
//  3. Assert generated replacement newlines use `\r\n`, preserving the suffix LF.
//
// @evidence contracts/testing.md#behavioral-verification The owned object replacement must use CRLF for every synthesized child/closing-brace newline while preserving its properties, values and the original statement-suffix LF outside that edit.
// @evidence contracts/testing.md#independent-expectations The explicit endOfLine option governs printer-generated line endings. The literal expected source independently limits the rewrite to its node range, retaining the original semicolon and following LF.
// @evidence contracts/testing.md#distinguishing-cases Input uses LF and the broken replacement uses CRLF only inside the owned object. The default-width object positive supplies LF reflow, and separate whole-command cases own full-file newline normalization.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthHonorsCRLFEndOfLine owns its literal LF source, node-local mixed-ending complete output and explicit width/crlf options in the selected public Go unit population. Owning operations, engine and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatPrintWidthHonorsCRLFEndOfLine(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const x = { aa: 1, bb: 2, cc: 3 };\n",
    `{"printWidth": 20, "endOfLine": "crlf"}`,
    "const x = {\r\n  aa: 1,\r\n  bb: 2,\r\n  cc: 3,\r\n};\n",
  )
}
