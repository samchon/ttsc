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
func TestFormatWhitespacePreservesCRLFUnderCRLFEndOfLine(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/whitespace",
    "const a = 1; \r\nconst b = 2;\r\n",
    `{"endOfLine":"crlf"}`,
    "const a = 1;\r\nconst b = 2;\r\n",
  )
}
