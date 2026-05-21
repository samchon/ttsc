package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchBlockReturnsVerbatimForNilStatements verifies that printBlock
// falls back to verbatim when the block node has a nil Statements list.
//
// The guard `block == nil || block.Statements == nil` protects the statement
// iterator from a nil dereference. A synthetic block produced by the node
// factory with no statement list hits this guard: the printer cannot iterate
// nil statements, so it emits the source bytes verbatim. This path is reached
// when an error-recovery pass creates a skeletal block without attaching a
// statement list.
//
//  1. Create a synthetic Block node with Statements=nil via NewNodeFactory.
//  2. Build a PrintContext from a real parsed file so ctx.Source is valid.
//  3. Call printBlock(ctx, syntheticNode) directly.
//  4. Assert the output is empty (zero-range verbatim) and covered is true.
func TestDispatchBlockReturnsVerbatimForNilStatements(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())

  // NewBlock(nil, false) → Statements == nil → guard fires → verbatim.
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  syntheticNode := factory.NewBlock(nil, false)

  doc, covered := printBlock(ctx, syntheticNode)
  if !covered {
    t.Fatalf("nil-statements block should be covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-statements block should produce empty output, got %q", got)
  }
}
