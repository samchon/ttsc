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
func TestFormatPrintWidthAbstainsWhenTrailingBlockCommentBeforeCloseBracket(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "formatPrintWidth",
    "foo(a, b /* tail */);\n",
    `{"printWidth": 10}`,
  )
}
