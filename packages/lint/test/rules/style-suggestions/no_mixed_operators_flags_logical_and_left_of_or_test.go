package linthost

import "testing"

// TestNoMixedOperatorsFlagsLogicalAndLeftOfOr verifies the canonical mix
// `a && b || c` is flagged on the inner `a && b`.
//
// `&&` and `||` share ESLint's LOGICAL group but differ in precedence, so
// `(a && b) || c` reads ambiguously and upstream reports it. The diagnostic
// lands on the higher-binding left operand — the sub-expression a paren would
// wrap.
//
// 1. Write `const x = a && b || c;`.
// 2. Enable no-mixed-operators with default options.
// 3. Assert exactly one finding spanning `a && b`.
//
// @evidence contracts/testing.md#behavioral-verification Reports exactly the left a&&b span in a&&b||c.
// @evidence contracts/testing.md#independent-expectations && has tighter precedence than || within the supported logical group; the literal marker independently identifies the implicated inner expression.
// @evidence contracts/testing.md#distinguishing-cases Left nesting complements the right-nesting sibling and parenthesized exemption.
// @evidence contracts/testing.md#execution-ownership assertRuleFindingRanges executes no-mixed-operators on this entry's literal source and compares its exact authored inner-expression marker. This Test owns the range and cardinality expectations. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsFlagsLogicalAndLeftOfOr(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a && b || c;\n",
    "a && b",
  )
}
