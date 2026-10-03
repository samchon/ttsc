package linthost

import "testing"

// TestFormatPrintWidthTrailingLineWidthExcludesTrailingLineComment
// verifies trailingLineWidth stops at a `//` line comment instead of
// charging the comment bytes against the suffix budget.
//
// A trailing line attachment does not spend the supported suffix
// budget. This accounting is consumed by the rule's fast-path fit
// check and flat-only suffix-reduced rendering. The direct helper
// cases contrast line comments with counted block comments and a
// newline boundary, without observing a benchmark branch or consumer.
//
//  1. Call trailingLineWidth across a `;` + trailing line comment.
//  2. Assert the returned width covers only the un-movable `;`.
//  3. Spot-check a leading-whitespace + comment case to lock the
//     trimming branch.
//  4. Contrast a counted block-comment suffix and the next-line stopping boundary.
//
// @evidence contracts/testing.md#behavioral-verification trailingLineWidth must exclude trailing line-comment bytes and whitespace, still charge twelve columns for the authored block-comment suffix, and stop at LF.
// @evidence contracts/testing.md#independent-expectations Independent literal suffix lengths distinguish the free line attachment from the counted block-comment payload. Explicit one/zero/twelve results enforce the supported suffix budget without reading rule-generated output.
// @evidence contracts/testing.md#distinguishing-cases Original semicolon/comment and whitespace/comment cases are retained; adjacent block-comment and newline-ending suffixes prevent treating all comments or later-line text as free.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthTrailingLineWidthExcludesTrailingLineComment owns the original suffix assertions and added block-comment/newline boundaries through direct trailingLineWidth calls in the selected public Go unit population. Direct trailingLineWidth calls execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatPrintWidthTrailingLineWidthExcludesTrailingLineComment(t *testing.T) {
  if got := trailingLineWidth("; // trailing\n", 0, 2); got != 1 {
    t.Fatalf("semi + line comment: want 1, got %d", got)
  }
  if got := trailingLineWidth("   // only a comment\n", 0, 2); got != 0 {
    t.Fatalf("whitespace + line comment: want 0, got %d", got)
  }
  if got := trailingLineWidth("; /* tail */\n", 0, 2); got != 12 {
    t.Fatalf("block comment remains charged: want 12, got %d", got)
  }
  if got := trailingLineWidth(";\nnext", 0, 2); got != 1 {
    t.Fatalf("newline ends suffix: want 1, got %d", got)
  }
}
