package linthost

import "testing"

// TestNoMixedOperatorsFlagsMultiplicativeWithinAdditive verifies `a + b * c`
// is flagged on the inner `b * c`.
//
// This is the false negative from issue #611: the earlier port omitted
// arithmetic entirely, so `a + b * c` reported nothing. Upstream keeps
// arithmetic in the default groups — `*` and `+` share the ARITHMETIC group
// but differ in precedence — so the multiplicative sub-expression is reported.
//
// 1. Write `const x = a + b * c;`.
// 2. Enable no-mixed-operators with default options.
// 3. Assert exactly one finding spanning `b * c`.
func TestNoMixedOperatorsFlagsMultiplicativeWithinAdditive(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a + b * c;\n",
    "b * c",
  )
}
