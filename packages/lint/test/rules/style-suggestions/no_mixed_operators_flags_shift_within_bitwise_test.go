package linthost

import "testing"

// TestNoMixedOperatorsFlagsShiftWithinBitwise verifies `a & b << c` is flagged
// on the inner `b << c`.
//
// ESLint's BITWISE group holds the shift operators (`<<`) alongside `&`, `|`,
// and `^`; the shift and bitwise-AND precedences differ, so the mix is
// reported. This exercises the bitwise family the same way the comparison and
// arithmetic families are exercised elsewhere.
//
// 1. Write `const x = a & b << c;` (parses as `a & (b << c)`).
// 2. Enable no-mixed-operators with default options.
// 3. Assert exactly one finding spanning `b << c`.
func TestNoMixedOperatorsFlagsShiftWithinBitwise(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a & b << c;\n",
    "b << c",
  )
}
