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
//
// @evidence contracts/testing.md#behavioral-verification Reports exactly b<c nested inside a== expression.
// @evidence contracts/testing.md#independent-expectations The supported comparison/equality group contains both operators with different precedences; the literal inner marker is the range oracle.
// @evidence contracts/testing.md#distinguishing-cases Relational/equality positive contrasts with bitwise/comparison cross-group allowance.
// @evidence contracts/testing.md#execution-ownership assertRuleFindingRanges executes no-mixed-operators on this entry's literal source and compares its exact authored inner-expression marker. This Test owns the range and cardinality expectations. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsFlagsRelationalWithinEquality(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a == b < c;\n",
    "b < c",
  )
}
