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
//
// @evidence contracts/testing.md#behavioral-verification format/statement-split must move both later declarations onto separate lines in one fix, preserving the a/b/c declaration order and values one/two/three.
// @evidence contracts/testing.md#independent-expectations The independently authored three-line literal specifies all required breaks and unchanged declarations, detecting a rewrite that handles only the second statement.
// @evidence contracts/testing.md#distinguishing-cases Three same-line statements require two edits; the two-statement positive and already-separated three-statement negative cover the neighboring populations.
// @evidence contracts/testing.md#execution-ownership TestFormatStatementSplitBreaksThreeStatementsOnOneLine is a public Go unit selected by the lint semantic-unit Evidence claim. Its shared syntax-only harness invokes the owning formatter on temporary fixture source and applies its reported edits for exact output assertions in the same process, without a consumer install, native product build or host execution.
func TestFormatStatementSplitBreaksThreeStatementsOnOneLine(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/statement-split",
    "const a = 1; const b = 2; const c = 3;\n",
    "const a = 1;\nconst b = 2;\nconst c = 3;\n",
  )
}
