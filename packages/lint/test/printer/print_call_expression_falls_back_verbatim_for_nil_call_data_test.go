package linthost

import (
  "testing"
  "unsafe"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// iface mirrors the two-word memory layout of any Go interface value.
// The Go specification guarantees that all interface values share this
// layout: a non-nil type pointer (the itab) and a data pointer (which
// may be nil for a typed-nil interface value).
type iface struct {
  typ unsafe.Pointer
  val unsafe.Pointer
}

// TestPrintCallExpressionFallsBackVerbatimForNilCallData verifies that
// printCallExpression calls verbatim(ctx, node) when node.AsCallExpression()
// returns nil.
//
// AsCallExpression() is `n.data.(*CallExpression)`. This returns nil only
// when n.data holds a typed-nil *CallExpression (i.e., the interface has a
// non-nil type pointer but a nil value pointer). Achieving that state
// requires writing to the unexported `data` field via unsafe.Pointer, using
// the itab extracted from a legitimately created CallExpression node.
//
// The Node struct layout (verified with reflect.Type on 64-bit platforms):
//
//  Field 0 Kind   (offset=0,  size=2)
//  Field 1 Flags  (offset=4,  size=4)
//  Field 2 Loc    (offset=8,  size=8)
//  Field 3 id     (offset=16, size=8)
//  Field 4 Parent (offset=24, size=8)
//  Field 5 data   (offset=32, size=16)  ← interface{type, value}
//
//  1. Parse `foo(a);` to obtain a real CallExpression node (srcNode) whose
//     data field holds a non-nil *CallExpression.
//  2. Build a fresh Node and copy only the itab from srcNode.data, leaving
//     the value pointer nil → AsCallExpression() will return nil.
//  3. Assert printCallExpression emits verbatim output for that node.
func TestPrintCallExpressionFallsBackVerbatimForNilCallData(t *testing.T) {
  const dataFieldOffset = 32 // bytes from start of Node struct

  src := "foo(a);\n"
  file := parseTS(t, src)
  ctx := NewPrintContext(file, DefaultPrintOptions())

  // Step 1: obtain a real CallExpression node whose data is *CallExpression.
  srcNode := firstNodeOfKind(t, file, shimast.KindCallExpression)

  // Step 2: extract the itab (type pointer) from srcNode.data.
  srcIface := (*iface)(unsafe.Pointer(uintptr(unsafe.Pointer(srcNode)) + dataFieldOffset))

  // Build a fresh Node with KindCallExpression so verbatim() can reproduce
  // its source range. We copy only the structural fields (Kind, Loc) needed
  // for the fallback path; data will be set to the typed-nil.
  fakeNode := &shimast.Node{}
  // Shallow-copy Kind and Loc from srcNode so verbatim() sees valid bounds.
  *fakeNode = *srcNode

  // Overwrite data: same type pointer (itab), nil value pointer.
  dstIface := (*iface)(unsafe.Pointer(uintptr(unsafe.Pointer(fakeNode)) + dataFieldOffset))
  dstIface.typ = srcIface.typ
  dstIface.val = nil

  // Verify that AsCallExpression() now returns nil.
  if fakeNode.AsCallExpression() != nil {
    t.Fatalf("expected AsCallExpression() == nil after typed-nil injection")
  }

  // Step 3: printCallExpression must fall back to verbatim output.
  doc, _ := printCallExpression(ctx, fakeNode)
  got := Print(doc, ctx.Opts)
  if got != "foo(a)" {
    t.Fatalf("verbatim fallback mismatch: %q", got)
  }
}
