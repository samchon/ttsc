package linthost

import "testing"

// TestFormatWhitespaceNormalizesCRLFToLFByDefault verifies the rule
// strips interior `\r` when the effective EOL is LF (the default).
//
// Under LF EOL a `\r` before `\n` is a stray carriage return and counts
// as trailing whitespace, so a CRLF file normalizes to LF. This pins the
// LF arm of the EOL-gated `\r` handling, the counterpart to the CRLF
// preservation case.
//
//  1. Parse a CRLF file with no options (default LF EOL).
//  2. Apply the rule through the disk-backed fixer.
//  3. Assert every `\r\n` becomes `\n`.
func TestFormatWhitespaceNormalizesCRLFToLFByDefault(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const a = 1;\r\nconst b = 2;\r\n",
    "const a = 1;\nconst b = 2;\n",
  )
}
