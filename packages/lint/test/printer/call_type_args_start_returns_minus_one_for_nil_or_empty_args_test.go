package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCallTypeArgsStartReturnsMinus1ForNilOrEmptyArgs verifies that
// callTypeArgsStart returns -1 when the TypeArguments list is nil, when
// the list's Nodes slice is empty, when the first node in the list is
// nil, and when no `<` is found scanning backward from the first node's
// position.
//
// These internal guards inside callTypeArgsStart exist because the caller
// (printCallExpression) only calls the helper when TypeArguments != nil —
// the nil guard inside the helper is a belt-and-suspenders safety check.
// The nil-first-node guard prevents an NPE on first.Pos() for a
// hypothetically malformed list. The scan-failure return is the defensive
// fallback when source bytes don't contain `<` before the first type
// argument. All arms were unreachable via the normal parse path.
//
//  1. Extract a CallExpression with no type arguments (TypeArguments==nil)
//     from a parsed `foo(x)` source; call callTypeArgsStart directly and
//     assert -1.
//  2. Construct a NodeList with an empty Nodes slice and assert -1.
//  3. Construct a NodeList whose first element is nil and assert -1.
//  4. Construct a NodeList with a zero-value Node (Pos==0) so the backward
//     scan has no characters to search, and assert -1.
func TestCallTypeArgsStartReturnsMinus1ForNilOrEmptyArgs(t *testing.T) {
  file := parseTS(t, "foo(x);\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  call := node.AsCallExpression()

  // 1. nil TypeArguments — exercises the nil branch of the guard.
  if got := callTypeArgsStart(ctx, call); got != -1 {
    t.Fatalf("callTypeArgsStart with nil TypeArguments: want -1, got %d", got)
  }

  // 2. Empty Nodes slice — exercises the len == 0 branch.
  emptyList := &shimast.NodeList{Nodes: []*shimast.Node{}}
  call.TypeArguments = emptyList
  if got := callTypeArgsStart(ctx, call); got != -1 {
    t.Fatalf("callTypeArgsStart with empty Nodes: want -1, got %d", got)
  }

  // 3. Nil first entry — exercises the first == nil branch.
  nilFirstList := &shimast.NodeList{Nodes: []*shimast.Node{nil}}
  call.TypeArguments = nilFirstList
  if got := callTypeArgsStart(ctx, call); got != -1 {
    t.Fatalf("callTypeArgsStart with nil first node: want -1, got %d", got)
  }

  // 4. Zero-value Node at position 0 — the backward scan starts at -1
  //    (pos-1 = 0-1 = -1), which fails the i >= 0 guard immediately,
  //    so the function falls through to return -1.
  zeroNode := &shimast.Node{}
  posZeroList := &shimast.NodeList{Nodes: []*shimast.Node{zeroNode}}
  call.TypeArguments = posZeroList
  if got := callTypeArgsStart(ctx, call); got != -1 {
    t.Fatalf("callTypeArgsStart with pos-zero node: want -1, got %d", got)
  }
}
