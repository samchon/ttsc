package linthost

import "testing"

// TestNoMixedOperatorsFlagsShiftWithinBitwise verifies `a & b << c` is flagged
// on both bitwise operator tokens.
//
// ESLint's BITWISE group holds the shift operators (`<<`) alongside `&`, `|`,
// and `^`; the shift and bitwise-AND precedences differ, so the mix is
// reported. This exercises the bitwise family the same way the comparison and
// arithmetic families are exercised elsewhere.
//
// 1. Write `const x = a & b << c;` (parses as `a & (b << c)`).
// 2. Enable no-mixed-operators with default options.
// 3. Assert exactly two findings spanning `&` and `<<`.
//
// @evidence contracts/testing.md#behavioral-verification Reports exactly & and << for a shift nested under bitwise AND.
// @evidence contracts/testing.md#independent-expectations Shift and bitwise AND share a default group with differing precedence; ESLint reports both tokens, and literal markers define their ranges independently.
// @evidence contracts/testing.md#distinguishing-cases Within-bitwise-group positive contrasts with bitwise/logical cross-group negative.
// @evidence contracts/testing.md#execution-ownership assertRuleFindingRanges executes the shift/bitwise source and compares both authored token ranges in the Go unit process.
func TestNoMixedOperatorsFlagsShiftWithinBitwise(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a & b << c;\n",
    "&", "<<",
  )
}
