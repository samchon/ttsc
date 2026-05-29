package linthost

import "testing"

// TestFormatStatementSplitIndentsSplitStatementInsideBlock verifies the
// rule indents the statement it breaks out to the enclosing block's
// depth, not column 0.
//
// A block body lives one nesting level deep, so the inserted line break
// must carry the depth-1 indent (two spaces by default). This pins that
// the rule reads the statement's nesting depth rather than always
// emitting a bare newline.
//
//  1. Parse a function whose block holds two statements on one line.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the second statement lands on its own line at the block
//     indent.
func TestFormatStatementSplitIndentsSplitStatementInsideBlock(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/statement-split",
    "function f() {\n  const a = 1; const b = 2;\n}\n",
    "function f() {\n  const a = 1;\n  const b = 2;\n}\n",
  )
}
