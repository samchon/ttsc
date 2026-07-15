package linthost

import "testing"

// TestNoMixedOperatorsFlagsRelationalWithinEquality verifies `a == b < c` is
// flagged on the inner `b < c`.
//
// ESLint's COMPARISON group holds both equality (`==`) and relational (`<`)
// operators, and they have different precedences, so mixing them inside one
// group is reported. This locks that the group model spans a whole family, not
// just a single precedence tier.
//
// 1. Write `const x = a == b < c;` (parses as `a == (b < c)`).
// 2. Enable no-mixed-operators with default options.
// 3. Assert exactly one finding spanning `b < c`.
func TestNoMixedOperatorsFlagsRelationalWithinEquality(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a == b < c;\n",
    "b < c",
  )
}
