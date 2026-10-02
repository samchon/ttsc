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
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must push a statement-body else onto a new line using the configured CRLF ending without introducing any bare LF.
// @evidence contracts/testing.md#independent-expectations The literal output retains both calls and condition and uses CRLF on every line; the helper compares the entire fixed source and separately rejects lone LF bytes in the actual output.
// @evidence contracts/testing.md#distinguishing-cases This configured-EOL positive complements default-LF pushing and the already-split negative; it owns a synthesized CRLF boundary rather than merely checking the input endings.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationHonorsCRLFEndOfLine is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns the source and independent literal output; the shared syntax-only harness invokes the rule and applies its edits in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationHonorsCRLFEndOfLine(t *testing.T) {
  assertFixCRLFConsistentWithOptions(
    t,
    "format/brace-continuation",
    "if (a) x(); else y();\r\n",
    `{"endOfLine":"crlf"}`,
    "if (a) x();\r\nelse y();\r\n",
  )
}
