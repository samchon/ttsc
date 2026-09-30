package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// Verifies nil-entry detection distinguishes malformed and valid argument lists.
//
// This predicate supplies printer fallback guards. It must detect a missing
// entry without treating a parsed, complete argument list as malformed.
//
// 1. Construct a list containing nil and require detection.
// 2. Parse foo(a) and require its intact argument list to remain valid.
//
// @evidence contracts/testing.md#behavioral-verification hasNilEntry must return true for a nil entry and false for the parsed foo(a) argument list; it does not itself execute call printing.
// @evidence contracts/testing.md#independent-expectations The explicit nil operand and the parser-created nonnil argument provide independent predicate expectations.
// @evidence contracts/testing.md#distinguishing-cases Adjacent malformed and valid list inputs cover both decisions; the nil-list identity is owned by TestHasNilEntryReturnsFalseForNilList.
// @evidence contracts/testing.md#execution-ownership TestHasNilEntryDistinguishesMalformedAndValidLists is a selected public Go printer unit under TestSelectedLintUnits. It calls the predicate in the shared Go process, without installation, native build or host startup.
func TestHasNilEntryDistinguishesMalformedAndValidLists(t *testing.T) {
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
