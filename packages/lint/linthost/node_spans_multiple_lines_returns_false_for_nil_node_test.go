package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

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
//
// @evidence contracts/testing.md#behavioral-verification nodeSpansMultipleLines must reject nil and a single-line numeric node while accepting an object whose actual source range crosses line breaks.
// @evidence contracts/testing.md#independent-expectations The single-line numeric literal and multiline object source establish line membership independently of the predicate.
// @evidence contracts/testing.md#distinguishing-cases Nil, one-line and multiline nodes expose both decisions; out-of-range verbatim cases cover invalid source ranges separately.
// @evidence contracts/testing.md#execution-ownership TestNodeSpansMultipleLinesReturnsFalseForNilNode is one Go unit entry that parses two small sources in-process with the TypeScript-Go parser and calls the unexported nodeSpansMultipleLines on nil, a numeric literal and an object literal; it installs, builds and launches nothing.
func TestNodeSpansMultipleLinesReturnsFalseForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  if nodeSpansMultipleLines(ctx, nil) {
    t.Fatal("nodeSpansMultipleLines(nil): want false, got true")
  }
  single := firstNodeOfKind(t, file, shimast.KindNumericLiteral)
  if nodeSpansMultipleLines(ctx, single) {
    t.Fatal("a single-line literal must not span multiple lines")
  }
  multipleFile := parseTS(t, "const values = {\n  a: 1,\n  b: 2\n};\n")
  multipleContext := NewPrintContext(multipleFile, DefaultPrintOptions())
  multiple := firstNodeOfKind(t, multipleFile, shimast.KindObjectLiteralExpression)
  if !nodeSpansMultipleLines(multipleContext, multiple) {
    t.Fatal("a multiline object must span multiple lines")
  }
}
