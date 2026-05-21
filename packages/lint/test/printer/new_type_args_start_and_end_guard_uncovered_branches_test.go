package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNewTypeArgsStartAndEndGuardUncoveredBranches verifies the nil / empty
// guards inside newTypeArgsStart and newTypeArgsEnd, which are never
// exercised through printNewExpression because that caller already guards
// on ne.TypeArguments != nil before delegating.
//
// These functions mirror callTypeArgsStart / callTypeArgsEnd for the
// NewExpression form. Because no prior test exercised any code path through
// them (0% coverage), this case pins both helpers end-to-end: the nil
// TypeArguments guard, the empty-Nodes guard, the nil-first-node guard,
// the scan-failure arms (no `<` / no `>` found), and the main `<…>` scan
// path exercised via the TestPrintNewExpressionIncludesTypeArguments peer.
//
//  1. Parse `new Foo(x)` to get a NewExpression whose TypeArguments is nil;
//     call newTypeArgsStart and newTypeArgsEnd directly and assert -1.
//  2. Set TypeArguments to an empty NodeList and assert -1 for Start.
//  3. Set TypeArguments to a NodeList with a nil first entry and assert -1
//     for Start.
//  4. Set TypeArguments to a NodeList with a zero-value Node (Pos==0) so
//     the backward scan has no room to find `<`, and assert -1 for Start.
//  5. Set TypeArguments to a zero-value NodeList (End()==0) and confirm
//     newTypeArgsEnd returns the end offset when source has no `>`.
func TestNewTypeArgsStartAndEndGuardUncoveredBranches(t *testing.T) {
  file := parseTS(t, "new Foo(x);\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  node := firstNodeOfKind(t, file, shimast.KindNewExpression)
  ne := node.AsNewExpression()

  // 1. nil TypeArguments — both helpers should return -1.
  if got := newTypeArgsStart(ctx, ne); got != -1 {
    t.Fatalf("newTypeArgsStart with nil TypeArguments: want -1, got %d", got)
  }
  if got := newTypeArgsEnd(ctx, ne); got != -1 {
    t.Fatalf("newTypeArgsEnd with nil TypeArguments: want -1, got %d", got)
  }

  // 2. Empty Nodes slice — newTypeArgsStart should return -1.
  ne.TypeArguments = &shimast.NodeList{Nodes: []*shimast.Node{}}
  if got := newTypeArgsStart(ctx, ne); got != -1 {
    t.Fatalf("newTypeArgsStart with empty Nodes: want -1, got %d", got)
  }

  // 3. Nil first entry — newTypeArgsStart should return -1.
  ne.TypeArguments = &shimast.NodeList{Nodes: []*shimast.Node{nil}}
  if got := newTypeArgsStart(ctx, ne); got != -1 {
    t.Fatalf("newTypeArgsStart with nil first node: want -1, got %d", got)
  }

  // 4. Zero-value Node at position 0 — the backward scan starts at -1
  //    (pos-1), which fails i >= 0 immediately, covering the end return -1.
  zeroNode := &shimast.Node{}
  ne.TypeArguments = &shimast.NodeList{Nodes: []*shimast.Node{zeroNode}}
  if got := newTypeArgsStart(ctx, ne); got != -1 {
    t.Fatalf("newTypeArgsStart with pos-zero node: want -1, got %d", got)
  }

  // 5. Zero-value NodeList has End()==0. Source "new Foo(x);\n" contains
  //    no `>`, so the forward scan finds nothing and returns the end
  //    offset (0). Covers the newTypeArgsEnd fallthrough return.
  zeroList := &shimast.NodeList{}
  ne.TypeArguments = zeroList
  if got := newTypeArgsEnd(ctx, ne); got != 0 {
    t.Fatalf("newTypeArgsEnd with no-close-bracket source: want 0 (end offset), got %d", got)
  }
}
