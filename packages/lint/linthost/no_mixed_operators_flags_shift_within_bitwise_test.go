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
//
// @evidence contracts/testing.md#behavioral-verification Reports exactly b<<c nested under bitwise &.
// @evidence contracts/testing.md#independent-expectations Shift and bitwise operators share the supported default group with differing precedence; literal inner source sets the independent span.
// @evidence contracts/testing.md#distinguishing-cases Within-bitwise-group positive contrasts with bitwise/logical cross-group negative.
// @evidence contracts/testing.md#execution-ownership assertRuleFindingRanges executes no-mixed-operators on this entry's literal source and compares its exact authored inner-expression marker. This Test owns the range and cardinality expectations. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsFlagsShiftWithinBitwise(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a & b << c;\n",
    "b << c",
  )
}
