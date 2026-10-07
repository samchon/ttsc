package linthost

import "testing"

// TestNoMixedOperatorsFlagsMultiplicativeWithinAdditive verifies `a + b * c`
// is flagged on both arithmetic operator tokens.
//
// Arithmetic belongs to the default groups. Multiplication and addition have
// different precedences, so the unparenthesized pair must report both tokens.
//
// 1. Write `const x = a + b * c;`.
// 2. Enable no-mixed-operators with default options.
// 3. Assert exactly two findings spanning `+` and `*`.
//
// @evidence contracts/testing.md#behavioral-verification Reports exactly + and * for multiplication nested under addition.
// @evidence contracts/testing.md#independent-expectations Arithmetic operators belong to one default group and differ in precedence; ESLint's two-token reporting and literal markers determine the ranges independently.
// @evidence contracts/testing.md#distinguishing-cases Arithmetic positive contrasts with same-precedence multiplication/division allowance and custom-group arithmetic omission.
// @evidence contracts/testing.md#execution-ownership assertRuleFindingRanges executes the authored arithmetic expression and compares its two token markers directly in the Go unit process.
func TestNoMixedOperatorsFlagsMultiplicativeWithinAdditive(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "no-mixed-operators",
    "const x = a + b * c;\n",
    "+", "*",
  )
}
