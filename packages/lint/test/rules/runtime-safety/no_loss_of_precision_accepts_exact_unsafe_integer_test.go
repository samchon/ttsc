package linthost

import "testing"

// TestNoLossOfPrecisionAcceptsExactUnsafeInteger verifies the 2^53 boundary.
//
// The rule reports precision loss, not every unsafe integer. 2^53 is outside
// Number.MAX_SAFE_INTEGER but still exactly representable; 2^53+1 is the first
// decimal integer literal that changes when parsed as a JavaScript Number.
//
// 1. Check that Number.MAX_SAFE_INTEGER is accepted.
// 2. Check that 2^53 is accepted because it is exactly representable.
// 3. Check that another exactly representable unsafe integer is accepted.
// 4. Check that 2^53+1, including separator form, is rejected.
func TestNoLossOfPrecisionAcceptsExactUnsafeInteger(t *testing.T) {
  if numericLiteralLosesPrecision("9007199254740991") {
    t.Fatal("Number.MAX_SAFE_INTEGER should not report precision loss")
  }
  if numericLiteralLosesPrecision("9007199254740992") {
    t.Fatal("2^53 is unsafe but exactly representable")
  }
  if numericLiteralLosesPrecision("9007199254740994") {
    t.Fatal("2^53+2 is unsafe but exactly representable")
  }
  if !numericLiteralLosesPrecision("9007199254740993") {
    t.Fatal("2^53+1 should report precision loss")
  }
  if !numericLiteralLosesPrecision("9_007_199_254_740_993") {
    t.Fatal("separator form of 2^53+1 should report precision loss")
  }
}
