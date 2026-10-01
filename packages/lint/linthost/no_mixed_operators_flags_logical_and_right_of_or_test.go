package linthost

import "testing"

// TestNoMixedOperatorsFlagsLogicalAndRightOfOr verifies `a || b && c` is
// flagged on the inner `b && c`.
//
// The mix is examined for either operand, not only the left one: here the
// tighter-binding `&&` sits on the RIGHT of `||`, and upstream still reports.
// This pins the right-child branch of the parent walk.
//
// 1. Write `const x = a || b && c;`.
// 2. Enable no-mixed-operators with default options.
// 3. Assert exactly one finding spanning `b && c`.
//
// @evidence contracts/testing.md#behavioral-verification Reports exactly the right b&&c span in a||b&&c.
// @evidence contracts/testing.md#independent-expectations The authored inner expression is the higher-precedence logical operation in the same group; the literal marker sets its range independently.
// @evidence contracts/testing.md#distinguishing-cases Right nesting complements left nesting and blocks a rule that only visits a left child.
// @evidence contracts/testing.md#execution-ownership assertRuleFindingRanges executes no-mixed-operators on this entry's literal source and compares its exact authored inner-expression marker. This Test owns the range and cardinality expectations. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsFlagsLogicalAndRightOfOr(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a || b && c;\n",
    "b && c",
  )
}
