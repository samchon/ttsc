package linthost

import (
  "testing"
  "unsafe"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintNewExpressionFallsBackVerbatimForNilNeData verifies that
// printNewExpression calls verbatim(ctx, node) when node.AsNewExpression()
// returns nil.
//
// AsNewExpression() is `n.data.(*NewExpression)`. This returns nil only when
// n.data holds a typed-nil *NewExpression (non-nil type pointer, nil value
// pointer). The same unsafe technique used for the CallExpression sibling
// test (TestPrintCallExpressionFallsBackVerbatimForNilCallData) applies here,
// injecting the itab from a real NewExpression node into a fresh Node's data
// field while setting the value pointer to nil.
//
//  1. Parse `new Foo(a);` to get a real NewExpression node with valid data.
//  2. Build a fresh Node (copying Kind and Loc) then inject a typed-nil
//     *NewExpression into its data field via the iface struct overlay.
//  3. Assert printNewExpression emits verbatim output for that node.
func TestPrintNewExpressionFallsBackVerbatimForNilNeData(t *testing.T) {
  const dataFieldOffset = 32 // bytes from start of Node struct (same layout as call sibling)

  src := "new Foo(a);\n"
  file := parseTS(t, src)
  ctx := NewPrintContext(file, DefaultPrintOptions())

  srcNode := firstNodeOfKind(t, file, shimast.KindNewExpression)

  // Extract the itab from srcNode.data.
  srcIface := (*iface)(unsafe.Pointer(uintptr(unsafe.Pointer(srcNode)) + dataFieldOffset))

  // Copy the whole node, then inject typed-nil in the data field.
  fakeNode := &shimast.Node{}
  *fakeNode = *srcNode

  dstIface := (*iface)(unsafe.Pointer(uintptr(unsafe.Pointer(fakeNode)) + dataFieldOffset))
  dstIface.typ = srcIface.typ
  dstIface.val = nil

  if fakeNode.AsNewExpression() != nil {
    t.Fatalf("expected AsNewExpression() == nil after typed-nil injection")
  }

  doc, _ := printNewExpression(ctx, fakeNode)
  got := Print(doc, ctx.Opts)
  if got != "new Foo(a)" {
    t.Fatalf("verbatim fallback mismatch: %q", got)
  }
}
