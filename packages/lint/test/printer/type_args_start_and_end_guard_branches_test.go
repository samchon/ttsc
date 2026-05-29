package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestTypeArgsStartAndEndGuardBranches pins the defensive guard branches of
// the shared typeArgsStart / typeArgsEnd helpers (used by both the call and
// new expression printers). Their callers only invoke them inside an
// `if ... TypeArguments != nil` guard, so the internal nil / empty /
// nil-first / scan-failure arms are otherwise unexercised.
//
//  1. nil list -> both return -1.
//  2. empty Nodes slice -> typeArgsStart returns -1.
//  3. nil first node -> typeArgsStart returns -1.
//  4. zero-value node (Pos 0) -> the backward `<` scan finds nothing, -1.
//  5. zero-value list (End 0) over source with no `>` -> typeArgsEnd
//     falls through to the end offset (0).
func TestTypeArgsStartAndEndGuardBranches(t *testing.T) {
  file := parseTS(t, "foo(x);\n")
  src := file.Text()

  // 1. nil list.
  if got := typeArgsStart(src, nil); got != -1 {
    t.Fatalf("typeArgsStart(nil): want -1, got %d", got)
  }
  if got := typeArgsEnd(src, nil); got != -1 {
    t.Fatalf("typeArgsEnd(nil): want -1, got %d", got)
  }

  // 2. empty Nodes slice.
  if got := typeArgsStart(src, &shimast.NodeList{Nodes: []*shimast.Node{}}); got != -1 {
    t.Fatalf("typeArgsStart(empty): want -1, got %d", got)
  }

  // 3. nil first node.
  if got := typeArgsStart(src, &shimast.NodeList{Nodes: []*shimast.Node{nil}}); got != -1 {
    t.Fatalf("typeArgsStart(nil first): want -1, got %d", got)
  }

  // 4. zero-value node at Pos 0 — the backward scan starts at -1 and bails.
  if got := typeArgsStart(src, &shimast.NodeList{Nodes: []*shimast.Node{{}}}); got != -1 {
    t.Fatalf("typeArgsStart(pos-zero): want -1, got %d", got)
  }

  // 5. zero-value list has End()==0; "foo(x);\n" has no `>`, so the forward
  //    scan finds nothing and typeArgsEnd returns the end offset (0).
  if got := typeArgsEnd(src, &shimast.NodeList{}); got != 0 {
    t.Fatalf("typeArgsEnd(no-close): want 0, got %d", got)
  }
}
