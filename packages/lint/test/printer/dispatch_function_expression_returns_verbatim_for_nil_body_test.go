package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchFunctionExpressionReturnsVerbatimForNilBody verifies that
// printFunctionExpression falls back to verbatim when the function-expression
// node has a nil body.
//
// Mirrors the nil-body guard in printArrowFunction: a synthetic or error-
// recovered function expression with no body must not panic. The guard
// `fn == nil || fn.Body == nil` catches this and emits the original source
// bytes verbatim. The test uses the node factory to produce a FunctionExpression
// with an explicit nil body — the only path to this branch without a
// parser-produced node.
//
//  1. Create a synthetic FunctionExpression node with Body=nil via NewNodeFactory.
//  2. Build a PrintContext from a real parsed file so ctx.Source is valid.
//  3. Call printFunctionExpression(ctx, syntheticNode) directly.
//  4. Assert the output is empty (verbatim of a zero-range node) and covered
//     is true.
//
// @evidence contracts/testing.md#behavioral-verification printFunctionExpression must safely return empty, covered output for a factory function whose Body is nil.
// @evidence contracts/testing.md#independent-expectations Its undefined source range provides no verbatim bytes; no function signature or braces may be invented.
// @evidence contracts/testing.md#distinguishing-cases The public missing-body fixture complements missing-node safety and real block-body reflow.
// @evidence contracts/testing.md#execution-ownership TestDispatchFunctionExpressionReturnsVerbatimForNilBody is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchFunctionExpressionReturnsVerbatimForNilBody(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())

  // Construct a synthetic FunctionExpression with nil body.
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  syntheticNode := factory.NewFunctionExpression(nil, nil, nil, nil, nil, nil, nil, nil)

  doc, covered := printFunctionExpression(ctx, syntheticNode)
  if !covered {
    t.Fatalf("nil-body function expression should be covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-body function expression should produce empty output, got %q", got)
  }
}
