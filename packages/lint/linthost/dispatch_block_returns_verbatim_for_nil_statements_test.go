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
// nil statements. The constructed block has an undefined range, so the
// verbatim fallback is empty. This test does not exercise an actual
// error-recovery pass or preservation of a parsed block's source bytes.
//
//  1. Create a synthetic Block node with Statements=nil via NewNodeFactory.
//  2. Build a PrintContext from a real parsed file so ctx.Source is valid.
//  3. Call printBlock(ctx, syntheticNode) directly.
//  4. Assert the output is empty (undefined-range verbatim) and covered is true.
//
// @evidence contracts/testing.md#behavioral-verification printBlock must return empty, covered output for a factory block with no statement list or valid source range.
// @evidence contracts/testing.md#independent-expectations The undefined-range factory fixture has no source bytes to copy; the defensive missing-list contract requires safe fallback.
// @evidence contracts/testing.md#distinguishing-cases Absent public Statements differs from a list containing a nil statement and an intact empty parsed block.
// @evidence contracts/testing.md#execution-ownership TestDispatchBlockReturnsVerbatimForNilStatements is a plain top-level Go unit test, selectable with go test -run, that calls printBlock directly on a factory-built block with no statement list inside the test process; it installs no consumer, builds no native artifact and starts no product host.
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
