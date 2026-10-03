package linthost

import "testing"

// TestNoMixedOperatorsFlagsLogicalAndRightOfOr verifies `a || b && c` is
// flagged on both operator tokens.
//
// The mix is examined for either operand, not only the left one: here the
// tighter-binding `&&` sits on the RIGHT of `||`, and upstream still reports.
// This pins the right-child branch of the parent walk.
//
// 1. Write `const x = a || b && c;`.
// 2. Enable no-mixed-operators with default options.
// 3. Assert exactly two findings spanning `||` and `&&`.
//
// @evidence contracts/testing.md#behavioral-verification Reports exactly the || and && tokens in a||b&&c, preserving two reports for the right-nested pair.
// @evidence contracts/testing.md#independent-expectations ESLint reports both operators for the higher-precedence logical child in the default group; literal token markers determine the two ranges independently.
// @evidence contracts/testing.md#distinguishing-cases Right nesting complements left nesting and blocks a rule that only visits a left child.
// @evidence contracts/testing.md#execution-ownership assertRuleFindingRanges executes the authored right-nested source and verifies both token ranges directly in the lint Go unit process.
func TestNoMixedOperatorsFlagsLogicalAndRightOfOr(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a || b && c;\n",
    "||", "&&",
  )
}
