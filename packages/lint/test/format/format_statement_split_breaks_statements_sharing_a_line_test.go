package linthost

import "testing"

// TestFormatStatementSplitBreaksStatementsSharingALine verifies
// formatStatementSplit puts two top-level statements that share one
// physical line onto their own lines.
//
// This is the headline behavior: Prettier never leaves
// `const a = 1; let b = 2;` on one line. The rule inserts EOL + the
// depth-0 indent ("" at top level) before the second statement.
//
//  1. Parse a file with two statements on a single line.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert each statement now starts its own line.
func TestFormatStatementSplitBreaksStatementsSharingALine(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/statement-split",
    "const a = 1; let b = 2;\n",
    "const a = 1;\nlet b = 2;\n",
  )
}
