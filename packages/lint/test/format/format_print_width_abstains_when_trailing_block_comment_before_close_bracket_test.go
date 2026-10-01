package linthost

import "testing"

// TestFormatPrintWidthAbstainsWhenTrailingBlockCommentBeforeCloseBracket
// verifies the rule abstains on a list whose last child carries a
// trailing `/* … */` comment before the closing bracket.
//
// Trailing block comments live in the inter-child gap between
// `lastChild.End()` and the closing token, which is exactly the
// surface `hasNonChildComments` scans. Reflowing the list would
// emit the close bracket immediately after the last child's render,
// dropping the comment. The safety check must catch it. The
// trailing-edge case is easy to miss because it does not look like
// a "between-members" comment to a casual reader — it sits at the
// edge of the list, not inside it.
//
//  1. Configure printWidth=10 so any reflow attempt would fire.
//  2. Feed `foo(a, b /* tail */);` — comment sits after `b` and
//     before `)`.
//  3. Assert the rule emits zero findings — comment preserved by
//     abstention.
// @evidence contracts/testing.md#behavioral-verification Runs format/print-width at printWidth 10 on `foo(a, b /* tail */);` and requires zero findings so the trailing comment before `)` is preserved.
// @evidence contracts/testing.md#independent-expectations The expected zero findings follows from the contract that reflow must not drop a comment; the authored input exceeds the width so a reflow would otherwise fire.
// @evidence contracts/testing.md#distinguishing-cases One abstention case with the comment after the last argument and before the closing bracket, the edge position that a between-members check could miss; a comment between members is owned by the inter-member test.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls assertRuleSkipsSourceWithOptions, which runs the engine with the single rule on a temp-dir file; no child process, built binary or installed consumer.
func TestFormatPrintWidthAbstainsWhenTrailingBlockCommentBeforeCloseBracket(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "foo(a, b /* tail */);\n",
    `{"printWidth": 10}`,
  )
}
