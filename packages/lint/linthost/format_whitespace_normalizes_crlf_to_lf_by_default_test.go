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
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must convert both CRLF separators to LF under default EOL while preserving both declarations.
// @evidence contracts/testing.md#independent-expectations The independent escaped output specifies the exact LF separators and unchanged a=1/b=2 payload.
// @evidence contracts/testing.md#distinguishing-cases This changed default-CRLF source complements explicit crlf preservation and canonical LF negatives.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespaceNormalizesCRLFToLFByDefault is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and applies edits for complete output comparisons in the same process without a consumer install, native product build or product host.
func TestFormatWhitespaceNormalizesCRLFToLFByDefault(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const a = 1;\r\nconst b = 2;\r\n",
    "const a = 1;\nconst b = 2;\n",
  )
}
