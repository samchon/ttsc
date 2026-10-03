package linthost

import "testing"

// TestNoMixedOperatorsFlagsLogicalAndLeftOfOr verifies the canonical mix
// `a && b || c` is flagged on both operator tokens.
//
// `&&` and `||` share ESLint's LOGICAL group but differ in precedence, so
// the unparenthesized pair receives two upstream operator diagnostics.
// Parenthesizing the higher-binding left operand exempts that pair.
//
// 1. Write `const x = a && b || c;`.
// 2. Enable no-mixed-operators with default options.
// 3. Assert exactly two findings spanning `&&` and `||`.
//
// @evidence contracts/testing.md#behavioral-verification Reports exactly the && and || tokens in a&&b||c, preserving two reports for the left-nested pair.
// @evidence contracts/testing.md#independent-expectations ESLint reports both operators for a mixed pair; && binds tighter than || within the default logical group, and the authored token markers establish independent ranges.
// @evidence contracts/testing.md#distinguishing-cases Left nesting complements the right-nesting sibling and parenthesized exemption.
// @evidence contracts/testing.md#execution-ownership assertRuleFindingRanges executes the literal source directly through the lint engine and compares two authored token ranges in the Go unit process.
func TestNoMixedOperatorsFlagsLogicalAndLeftOfOr(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a && b || c;\n",
    "&&", "||",
  )
}
