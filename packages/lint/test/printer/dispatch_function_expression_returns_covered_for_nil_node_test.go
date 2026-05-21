package linthost

import (
  "testing"
)

// TestDispatchFunctionExpressionReturnsCoveredForNilNode verifies that
// printFunctionExpression returns an empty Doc and covered==true when called
// with a nil node.
//
// Mirrors the nil guard in printArrowFunction: the function-expression printer
// must handle a nil node without panicking. covered==true is returned because
// an empty Doc contributes no multi-line verbatim content. A regression that
// panicked or returned covered==false would break callers that defensively
// check for nil before dispatching.
//
//  1. Build a PrintContext from any valid parsed file.
//  2. Call printFunctionExpression(ctx, nil) directly.
//  3. Assert the returned Doc is empty and covered is true.
func TestDispatchFunctionExpressionReturnsCoveredForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := printFunctionExpression(ctx, nil)
  if !covered {
    t.Fatalf("printFunctionExpression(nil) should return covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("printFunctionExpression(nil) should produce empty output, got %q", got)
  }
}
