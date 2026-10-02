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
//
// @evidence contracts/testing.md#behavioral-verification format/statement-split must move the second same-line declaration onto a new top-level line while retaining a=1, b=2 and their declaration kinds.
// @evidence contracts/testing.md#independent-expectations The independent complete source literal specifies one statement per LF line; the const and let payloads are unchanged by the expected whitespace edit.
// @evidence contracts/testing.md#distinguishing-cases This two-statement changed positive complements the already-one-per-line negative and gap-comment guard; the three-statement case owns multiple simultaneous splits.
// @evidence contracts/testing.md#execution-ownership TestFormatStatementSplitBreaksStatementsSharingALine is a public Go unit selected by the lint semantic-unit Evidence claim. Its shared syntax-only harness invokes the owning formatter on temporary fixture source and applies its reported edits for exact output assertions in the same process, without a consumer install, native product build or host execution.
func TestFormatStatementSplitBreaksStatementsSharingALine(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/statement-split",
    "const a = 1; let b = 2;\n",
    "const a = 1;\nlet b = 2;\n",
  )
}
