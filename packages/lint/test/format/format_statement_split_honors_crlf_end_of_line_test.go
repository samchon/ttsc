package linthost

import "testing"

// TestFormatStatementSplitHonorsCRLFEndOfLine verifies the inserted line
// break uses `\r\n` when `endOfLine` is `crlf`.
//
// The rule synthesizes its break from the shared layout's EOL. Under CRLF
// the break must be `\r\n`, not a bare `\n`, so a split file stays
// consistently CRLF. This pins that the layout's endOfLine drives the
// inserted separator.
//
//  1. Parse two CRLF-terminated statements sharing one line.
//  2. Apply the rule with `{"endOfLine":"crlf"}` through the fixer.
//  3. Assert the inserted break is `\r\n`.
func TestFormatStatementSplitHonorsCRLFEndOfLine(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/statement-split",
    "const a = 1; const b = 2;\r\n",
    `{"endOfLine":"crlf"}`,
    "const a = 1;\r\nconst b = 2;\r\n",
  )
}
