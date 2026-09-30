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
//
// @evidence contracts/testing.md#behavioral-verification Reports exactly b*c nested under addition.
// @evidence contracts/testing.md#independent-expectations Arithmetic operators belong to one default group and differ in precedence; literal b*c determines the expected span independently.
// @evidence contracts/testing.md#distinguishing-cases Arithmetic positive contrasts with same-precedence multiplication/division allowance and custom-group arithmetic omission.
// @evidence contracts/testing.md#execution-ownership assertRuleFindingRanges executes no-mixed-operators on this entry's literal source and compares its exact authored inner-expression marker. This Test owns the range and cardinality expectations. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsFlagsMultiplicativeWithinAdditive(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a + b * c;\n",
    "b * c",
  )
}
