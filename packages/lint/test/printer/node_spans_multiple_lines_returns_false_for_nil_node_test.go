package linthost

import "testing"

// TestNodeSpansMultipleLinesReturnsFalseForNilNode verifies the nil-node
// guard in nodeSpansMultipleLines returns false instead of dereferencing
// the pointer.
//
// nodeSpansMultipleLines is the coverage-signal helper the verbatim
// fallback consults. The dispatcher never hands it a nil node, so the
// guard needs a direct exercise to stay covered.
//
//  1. Build a PrintContext from a trivial parsed source.
//  2. Call nodeSpansMultipleLines with a nil node.
//  3. Assert it reports false.
func TestNodeSpansMultipleLinesReturnsFalseForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  if nodeSpansMultipleLines(ctx, nil) {
    t.Fatal("nodeSpansMultipleLines(nil): want false, got true")
  }
}
