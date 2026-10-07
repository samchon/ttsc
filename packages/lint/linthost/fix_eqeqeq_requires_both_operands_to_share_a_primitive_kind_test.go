package linthost

import "testing"

// TestFixEqeqeqRequiresBothOperandsToShareAPrimitiveKind verifies typeof is only half of the proof.
//
// An object compared with typeof can coerce to the resulting string. Changing
// the operator is automatic only when the other operand is also known string-valued.
//
// 1. Exercise both operand orders and both loose equality operators.
// 2. Keep coercible and differently typed operands unchanged.
// 3. Fix string literals and a second typeof expression exactly.
//
// @evidence contracts/testing.md#behavioral-verification The real Engine and fixer retain unsafe comparisons while rewriting known-string comparisons.
// @evidence contracts/testing.md#independent-expectations typeof produces strings; abstract equality can coerce an unknown object, unlike strict equality.
// @evidence contracts/testing.md#distinguishing-cases Both orders, equality and inequality, unknown objects and other primitive kinds contrast with two string-valued operands.
// @evidence contracts/testing.md#execution-ownership This unit applies Engine edits in process to owned fixture files without launching a compiler.
func TestFixEqeqeqRequiresBothOperandsToShareAPrimitiveKind(t *testing.T) {
  for _, operand := range []string{"x", "0", "true", "null", "undefined", "1n"} {
    for _, operator := range []string{"==", "!="} {
      for _, expression := range []string{"typeof value " + operator + " " + operand, operand + " " + operator + " typeof value"} {
        t.Run(expression, func(t *testing.T) { assertNoFixSnapshot(t, "eqeqeq", "const result = "+expression+";") })
      }
    }
  }
  assertFixSnapshot(t, "eqeqeq", "const a = typeof x == 'string';", "const a = typeof x === 'string';")
  assertFixSnapshot(t, "eqeqeq", "const a = 'string' != typeof x;", "const a = 'string' !== typeof x;")
  assertFixSnapshot(t, "eqeqeq", "const a = typeof x == typeof y;", "const a = typeof x === typeof y;")
}
