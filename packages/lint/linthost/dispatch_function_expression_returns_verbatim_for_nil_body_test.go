package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchFunctionExpressionReturnsVerbatimForNilBody verifies that
// printFunctionExpression falls back to verbatim when the function-expression
// node has a nil body.
//
// The guard `fn == nil || fn.Body == nil` catches the missing body and
// falls back to verbatim. The test explicitly supplies a factory node
// with an undefined range, so the result has no source bytes. It does
// not establish parser recovery or every way to reach this branch.
//
//  1. Create a synthetic FunctionExpression node with Body=nil via NewNodeFactory.
//  2. Build a PrintContext from a real parsed file so ctx.Source is valid.
//  3. Call printFunctionExpression(ctx, syntheticNode) directly.
//  4. Assert the output is empty (verbatim of an undefined-range node) and covered
//     is true.
//
// @evidence contracts/testing.md#behavioral-verification printFunctionExpression must safely return empty, covered output for a factory function whose Body is nil.
// @evidence contracts/testing.md#independent-expectations Its undefined source range provides no verbatim bytes; no function signature or braces may be invented.
// @evidence contracts/testing.md#distinguishing-cases The public missing-body fixture complements missing-node safety and real block-body reflow.
// @evidence contracts/testing.md#execution-ownership TestDispatchFunctionExpressionReturnsVerbatimForNilBody is a plain top-level Go unit test, selectable with go test -run, that calls printFunctionExpression directly on a factory-built function expression with no body inside the test process; it installs no consumer, builds no native artifact and starts no product host.
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
