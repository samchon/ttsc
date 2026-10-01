package linthost

import "testing"

// TestFormatReflowPreservesTernaryParenComment verifies a nested consequent
// retains a comment between its parentheses and conditional expression.
//
// Unwrapping that consequent for staircase layout must not drop the comment.
// A comment-free twin requires normal chain reflow at the same width.
//
// 1. Format the original comment-bearing parenthesized consequent unchanged.
// 2. Remove its comment and require the literal nested staircase output.
//
// @evidence contracts/testing.md#behavioral-verification The in-process format command must retain the comment inside the parenthesized nested consequent and keep the full original source. A paired comment-free consequent must reflow into the expected staircase, detecting a formatter that simply skips every conditional. The owned result is: Remove its comment and require the literal nested staircase output. .
// @evidence contracts/testing.md#independent-expectations Comment preservation requires retaining the authored comment bytes. Installed Prettier 3.8.3 supplies the literal comment-free staircase, whose nested consequent grouping preserves the conditional meaning without consulting this printer.
// @evidence contracts/testing.md#distinguishing-cases The original comment-bearing parenthesized consequent remains negative for reflow. Removing only that comment supplies a positive at the same width and nesting, distinguishing trivia protection from disabling the chain formatter.
// @evidence contracts/testing.md#execution-ownership TestFormatReflowPreservesTernaryParenComment owns both full source/output fixtures. The helper directly calls Go run in process and reads its temporary project output and streams without consumer installation, native artifact production or a product-host child.
func TestFormatReflowPreservesTernaryParenComment(t *testing.T) {
  assertFormatUnchanged(t, `const value = someOuterConditionValueHere
  ? (/* keep */ innerCondition ? innerTrueResultValue : innerFalseResultValue)
  : outerFalsyFallbackResultValue;
`)
  assertFormatResult(t,
    "const value = someOuterConditionValueHere\n  ? (innerCondition ? innerTrueResultValue : innerFalseResultValue)\n  : outerFalsyFallbackResultValue;\n",
    "const value = someOuterConditionValueHere\n  ? innerCondition\n    ? innerTrueResultValue\n    : innerFalseResultValue\n  : outerFalsyFallbackResultValue;\n")
}
