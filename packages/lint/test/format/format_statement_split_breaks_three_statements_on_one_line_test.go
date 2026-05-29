package linthost

import "testing"

// TestFormatStatementSplitBreaksThreeStatementsOnOneLine verifies the
// rule splits a line carrying three statements into three lines.
//
// One finding may carry many edits; three crammed statements must each
// land on their own line, not just the second. This pins that the walk
// reports every statement after the first, not a single break.
//
//  1. Parse three top-level statements sharing one line.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert each statement lands on its own line.
func TestFormatStatementSplitBreaksThreeStatementsOnOneLine(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/statement-split",
    "const a = 1; const b = 2; const c = 3;\n",
    "const a = 1;\nconst b = 2;\nconst c = 3;\n",
  )
}
