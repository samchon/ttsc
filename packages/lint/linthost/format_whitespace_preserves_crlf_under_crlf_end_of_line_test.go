package linthost

import "testing"

// TestFormatWhitespacePreservesCRLFUnderCRLFEndOfLine verifies the rule
// keeps interior `\r\n` line endings when `endOfLine` is `crlf`.
//
// Under CRLF the `\r` is part of the preserved terminator, so the
// trailing-space deletion must end before it. The complete output keeps
// both `\r\n` pairs while removing only the first line's stray space.
//
//  1. Parse a CRLF file whose first line carries a trailing space.
//  2. Apply the rule with `{"endOfLine":"crlf"}` through the fixer.
//  3. Assert every line keeps its `\r\n` terminator.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must remove the first-line stray space while retaining every CRLF pair under crlf.
// @evidence contracts/testing.md#independent-expectations The escaped full output literal preserves both declarations and all CRLF bytes, deleting only the pre-terminator space.
// @evidence contracts/testing.md#distinguishing-cases The changed CRLF tail contrasts with default CRLF-to-LF conversion and ordinary LF trimming.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespacePreservesCRLFUnderCRLFEndOfLine is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and applies edits for complete output comparisons in the same process without a consumer install, native product build or product host.
func TestFormatWhitespacePreservesCRLFUnderCRLFEndOfLine(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/whitespace",
    "const a = 1; \r\nconst b = 2;\r\n",
    `{"endOfLine":"crlf"}`,
    "const a = 1;\r\nconst b = 2;\r\n",
  )
}
