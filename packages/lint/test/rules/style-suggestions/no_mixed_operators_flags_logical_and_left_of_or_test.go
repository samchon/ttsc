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
func TestNoMixedOperatorsFlagsLogicalAndLeftOfOr(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a && b || c;\n",
    "a && b",
  )
}
