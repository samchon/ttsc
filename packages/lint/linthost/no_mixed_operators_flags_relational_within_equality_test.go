package linthost

import "testing"

// TestNoMixedOperatorsFlagsRelationalWithinEquality verifies `a == b < c` is
// flagged on both comparison operator tokens.
//
// ESLint's COMPARISON group holds both equality (`==`) and relational (`<`)
// operators, and they have different precedences, so mixing them inside one
// group is reported. This locks that the group model spans a whole family, not
// just a single precedence tier.
//
// 1. Write `const x = a == b < c;` (parses as `a == (b < c)`).
// 2. Enable no-mixed-operators with default options.
// 3. Assert exactly two findings spanning `==` and `<`.
//
// @evidence contracts/testing.md#behavioral-verification Reports exactly == and < for a relational operation nested under equality.
// @evidence contracts/testing.md#independent-expectations The default comparison group contains these different-precedence operators, and ESLint reports both tokens; literal markers define the ranges independently.
// @evidence contracts/testing.md#distinguishing-cases Relational/equality positive contrasts with bitwise/comparison cross-group allowance.
// @evidence contracts/testing.md#execution-ownership assertRuleFindingRanges executes the relational/equality source and compares both literal operator markers in the Go unit process.
func TestNoMixedOperatorsFlagsRelationalWithinEquality(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a == b < c;\n",
    "==", "<",
  )
}
