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
func TestNoMixedOperatorsFlagsLogicalAndRightOfOr(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a || b && c;\n",
    "b && c",
  )
}
