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
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule runs on the abstains when trailing block comment before close bracket fixture and must report no findings, rejecting an unnecessary or unsafe edit rather than only comparing two formatter outputs. The owned result is: Assert the rule emits zero findings — comment preserved by abstention.
// @evidence contracts/testing.md#independent-expectations The literal unchanged input and zero-finding expectation follow the preservation boundary described above, independently of printer output. This host proves abstention, while changing fixtures in sibling rule tests prove formatting correctness.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure printWidth=10 so any reflow attempt would fire. The asserted decision is: Assert the rule emits zero findings — comment preserved by abstention. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthAbstainsWhenTrailingBlockCommentBeforeCloseBracket is one Go unit entry through the fixture parser and rule engine; its zero-findings assertion uses no installed consumer, formatter subprocess or native build.
func TestFormatPrintWidthAbstainsWhenTrailingBlockCommentBeforeCloseBracket(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "foo(a, b /* tail */);\n",
    `{"printWidth": 10}`,
  )
}
