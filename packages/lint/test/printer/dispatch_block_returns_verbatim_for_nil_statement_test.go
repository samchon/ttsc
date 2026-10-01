package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchBlockReturnsVerbatimForNilStatement verifies that printBlock
// falls back to verbatim when the statement list contains a nil element.
//
// The per-statement nil guard `if stmt == nil { return verbatim(...) }` inside
// the loop prevents a nil dereference when iterating the block's statements.
// A nil element cannot appear in a parser-produced statement list, but it can
// appear in a synthetic block constructed by the node factory — for example
// when an error-recovery pass builds a partial statement list. Returning
// verbatim is the safe fallback: the printer cannot reconstruct a partially
// built statement, so it emits the whole block's source bytes unchanged.
//
//  1. Build a synthetic Block whose StatementList has exactly one nil element.
//  2. Build a PrintContext from a real parsed file so ctx.Source is valid.
//  3. Call printBlock(ctx, syntheticBlock) directly.
//  4. Assert the output is empty (verbatim of a zero-range block) and covered
//     is true (synthetic node spans no lines).
//
// @evidence contracts/testing.md#behavioral-verification printBlock must safely fall back to empty, covered output when a factory statement list contains nil.
// @evidence contracts/testing.md#independent-expectations The constructed block has no source span, so no statement or punctuation can legitimately be invented.
// @evidence contracts/testing.md#distinguishing-cases A present list with a missing item complements the absent-list fixture and covered valid statements.
// @evidence contracts/testing.md#execution-ownership TestDispatchBlockReturnsVerbatimForNilStatement is a plain top-level Go unit test, selectable with go test -run, that calls printBlock directly on a factory-built block whose statement list holds a nil entry inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchBlockReturnsVerbatimForNilStatement(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())

  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  // Create a StatementList with one nil entry to trigger the nil-statement guard.
  stmts := &shimast.NodeList{Nodes: []*shimast.Node{nil}}
  syntheticBlock := factory.NewBlock(stmts, false)

  doc, covered := printBlock(ctx, syntheticBlock)
  // Synthetic block has negative positions: verbatim returns empty; covered=true.
  if !covered {
    t.Fatalf("block with nil statement should be covered=true (empty verbatim), got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("block with nil statement should produce empty output, got %q", got)
  }
}
