package linthost

import "testing"

// TestFormatTrailingCommaSkipsInlineBlockCommentBeforeCloseBracket verifies
// the rule leaves the trailing comma off when a block comment sits between
// the last element and the close bracket on the SAME physical line.
//
// A block comment between the last element and closer must survive. The closer line controls comma insertion, so changing just that boundary distinguishes a safe no-op from an eligible edit.
//
//  1. Parse a source file with one multi-line array literal whose last
//     element is followed by an inline block comment and `]` on the same
//     line.
//  2. Run the engine with formatTrailingComma enabled.
//  3. Require silence, then move the closer to a new line and require its
//     comma while preserving the comment.
//
// @evidence contracts/testing.md#behavioral-verification An inline final-item comment and array closer on one line must produce no findings. Moving only the closer to the next line must add a comma before the comment and preserve its bytes.
// @evidence contracts/testing.md#independent-expectations The supported insertion policy follows the last-item-to-closer line boundary and retains trivia. Literal expected output places punctuation after the item while leaving the block comment unchanged independently of AST End positions.
// @evidence contracts/testing.md#distinguishing-cases The original same-line comment/closer stays negative, paired with a newline-close positive using the identical item and block comment. The line-comment host covers a different comment termination boundary.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaSkipsInlineBlockCommentBeforeCloseBracket owns the same-line no-finding fixture and complete newline-close comment-preserving output in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native builds or product-host children.
func TestFormatTrailingCommaSkipsInlineBlockCommentBeforeCloseBracket(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/trailing-comma",
    "const xs = [\n  1,\n  2/* note */];\n",
  )
  assertFixSnapshot(t, "format/trailing-comma",
    "const xs = [\n  1,\n  2/* note */\n];\n",
    "const xs = [\n  1,\n  2,/* note */\n];\n")
}
