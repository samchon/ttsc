package linthost

import "testing"

// TestFormatWhitespacePreservesCRLFUnderCRLFEndOfLine verifies the rule
// keeps interior `\r\n` line endings when `endOfLine` is `crlf`.
//
// The trailing-trim loop once stripped `\r` unconditionally, so a CRLF
// file silently lost its carriage returns even under `{"endOfLine":
// "crlf"}`. The fix only treats `\r` as trimmable whitespace under LF
// EOL; under CRLF the `\r` is half of the preserved terminator. This pins
// that a clean CRLF file with one trailing space is normalized to keep
// `\r\n` while the stray space is trimmed.
//
//  1. Parse a CRLF file whose first line carries a trailing space.
//  2. Apply the rule with `{"endOfLine":"crlf"}` through the fixer.
//  3. Assert every line keeps its `\r\n` terminator.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must remove the first-line stray space while retaining every CRLF pair under crlf.
// @evidence contracts/testing.md#independent-expectations The escaped full output literal preserves both declarations and all CRLF bytes, deleting only the pre-terminator space.
// @evidence contracts/testing.md#distinguishing-cases The changed CRLF tail contrasts with default CRLF-to-LF conversion and ordinary LF trimming.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespacePreservesCRLFUnderCRLFEndOfLine is a public Go unit selected by TestSelectedLintUnits. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and applies edits for complete output comparisons in the same process without a consumer install, native product build or product host.
func TestFormatWhitespacePreservesCRLFUnderCRLFEndOfLine(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/whitespace",
    "const a = 1; \r\nconst b = 2;\r\n",
    `{"endOfLine":"crlf"}`,
    "const a = 1;\r\nconst b = 2;\r\n",
  )
}
