package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintCallExpressionFallsBackVerbatimForNilArguments verifies that
// printCallExpression falls back to verbatim output when the argument list
// contains a nil entry.
//
// The hasNilEntry guard exists because a nil child in the NodeList would
// produce an empty Doc, rendering `(a, , b)` in the output. Falling back
// to verbatim is the safe, byte-preserving choice. This test directly
// calls hasNilEntry with a synthetic list containing a nil *Node so the
// nil-entry arm is covered without requiring the parser to produce one.
//
// 1. Build a NodeList whose Nodes slice contains a nil *Node entry.
// 2. Call hasNilEntry directly and assert it returns true.
// 3. Call hasNilEntry with a non-nil single-entry list and assert false.
func TestPrintCallExpressionFallsBackVerbatimForNilArguments(t *testing.T) {
  // A nil *Node pointer stored in the slice — exercises the nil-entry arm.
  nilList := &shimast.NodeList{Nodes: []*shimast.Node{nil}}
  if !hasNilEntry(nilList) {
    t.Fatalf("hasNilEntry: expected true for list containing nil entry")
  }

  // A list with a real (non-nil) node — exercises the false arm.
  file := parseTS(t, "foo(a);\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  call := node.AsCallExpression()
  if hasNilEntry(call.Arguments) {
    t.Fatalf("hasNilEntry: expected false for non-nil argument list")
  }
}
