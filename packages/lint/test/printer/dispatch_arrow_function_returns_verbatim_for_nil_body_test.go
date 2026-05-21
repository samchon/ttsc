package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchArrowFunctionReturnsVerbatimForNilBody verifies that
// printArrowFunction falls back to verbatim when the arrow function node has
// a nil body.
//
// The guard `arrow == nil || arrow.Body == nil` protects the printFunctionLike
// call from a nil dereference when a synthetic or error-recovered arrow
// function carries no body node. In that case the printer emits the original
// source bytes verbatim. This branch is exercised by constructing an
// ArrowFunction node through the node factory with an explicit nil body,
// which is the only way to reach the guard without a parser-produced node.
//
//  1. Create a synthetic ArrowFunction node with Body=nil via NewNodeFactory.
//  2. Build a PrintContext from a real parsed file so ctx.Source is valid.
//  3. Call printArrowFunction(ctx, syntheticNode) directly.
//  4. Assert the output is empty (verbatim of a zero-range node) and covered
//     is true (no multi-line content to taint the enclosing flag).
func TestDispatchArrowFunctionReturnsVerbatimForNilBody(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())

  // Construct a synthetic ArrowFunction with nil body.
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  syntheticNode := factory.NewArrowFunction(nil, nil, nil, nil, nil, nil, nil)

  doc, covered := printArrowFunction(ctx, syntheticNode)
  // Synthetic node has zero range: verbatim returns empty; covered=true.
  if !covered {
    t.Fatalf("nil-body arrow should be covered=true (empty verbatim), got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-body arrow should produce empty output, got %q", got)
  }
}
