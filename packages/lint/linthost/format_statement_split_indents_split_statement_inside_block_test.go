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
//
// @evidence contracts/testing.md#behavioral-verification format/statement-split must break the second function-body declaration at depth-one indentation while preserving the function, first declaration and braces.
// @evidence contracts/testing.md#independent-expectations The literal output gives the default two-space block indent and retains a=1 and b=2; zero-column insertion would fail independently of its computed depth.
// @evidence contracts/testing.md#distinguishing-cases The changed nested pair complements top-level no-indent splitting and already-separated statements; exact body output verifies both indentation and unchanged tokens.
// @evidence contracts/testing.md#execution-ownership TestFormatStatementSplitIndentsSplitStatementInsideBlock is a public Go unit selected by TestSelectedLintUnits. Its shared syntax-only harness invokes the owning formatter on temporary fixture source and applies its reported edits for exact output assertions in the same process, without a consumer install, native product build or host execution.
func TestFormatStatementSplitIndentsSplitStatementInsideBlock(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/statement-split",
    "function f() {\n  const a = 1; const b = 2;\n}\n",
    "function f() {\n  const a = 1;\n  const b = 2;\n}\n",
  )
}
