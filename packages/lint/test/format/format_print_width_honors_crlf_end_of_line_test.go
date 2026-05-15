package main

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
//  3. Assert each newline in the reflow is `\r\n`.
func TestFormatPrintWidthHonorsCRLFEndOfLine(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const x = { aa: 1, bb: 2, cc: 3 };\n",
    `{"printWidth": 20, "endOfLine": "crlf"}`,
    "const x = {\r\n  aa: 1,\r\n  bb: 2,\r\n  cc: 3,\r\n};\n",
  )
}
