package linthost

import "testing"

// TestFormatBraceContinuationHonorsCRLFEndOfLine verifies the pushed-down line
// break follows the configured end-of-line.
//
// This is the seventh format rule that synthesizes a line break, and #616 is the
// regression where one of them hardcoded LF and left a CRLF file with mixed
// endings. `endOfLine` is the only option this rule reads, so without this case
// it has none.
//
//  1. Parse a CRLF source whose `else` shares the consequent's line.
//  2. Apply format/brace-continuation under endOfLine "crlf".
//  3. Assert the synthesized break is CRLF and the file stays consistent.
func TestFormatBraceContinuationHonorsCRLFEndOfLine(t *testing.T) {
  assertFixCRLFConsistentWithOptions(
    t,
    "format/brace-continuation",
    "if (a) x(); else y();\r\n",
    `{"endOfLine":"crlf"}`,
    "if (a) x();\r\nelse y();\r\n",
  )
}
