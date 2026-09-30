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
//
// @evidence contracts/testing.md#behavioral-verification printFunctionExpression must produce empty output and covered true for nil.
// @evidence contracts/testing.md#independent-expectations The missing-subtree identity has no tokens or unsafe multiline verbatim slice.
// @evidence contracts/testing.md#distinguishing-cases Nil node complements a valid parsed function expression and a factory expression with no body.
// @evidence contracts/testing.md#execution-ownership TestDispatchFunctionExpressionReturnsCoveredForNilNode is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
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
