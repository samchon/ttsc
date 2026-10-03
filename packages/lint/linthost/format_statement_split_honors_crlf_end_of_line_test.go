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
//  1. Parse two statements sharing one CRLF-terminated line.
//  2. Apply the rule with `{"endOfLine":"crlf"}` through the fixer.
//  3. Assert the inserted break is `\r\n`.
//
// @evidence contracts/testing.md#behavioral-verification format/statement-split must insert CRLF between shared-line declarations when configured crlf, preserving both declarations and the existing terminal CRLF.
// @evidence contracts/testing.md#independent-expectations The explicit endOfLine contract and literal escaped CRLF output determine separator bytes independently of the layout loader.
// @evidence contracts/testing.md#distinguishing-cases This CRLF changed positive contrasts with default LF splitting and unchanged line-separated declarations; exact bytes reject a mixed bare-LF insertion.
// @evidence contracts/testing.md#execution-ownership TestFormatStatementSplitHonorsCRLFEndOfLine is a public Go unit selected by the lint semantic-unit Evidence claim. Its shared syntax-only harness invokes the owning formatter on temporary fixture source and applies its reported edits for exact output assertions in the same process, without a consumer install, native product build or host execution.
func TestFormatStatementSplitHonorsCRLFEndOfLine(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/statement-split",
    "const a = 1; const b = 2;\r\n",
    `{"endOfLine":"crlf"}`,
    "const a = 1;\r\nconst b = 2;\r\n",
  )
}
