package ast_test

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNodeTextSkipsEmptyQualifiedLeft verifies NodeText does not emit a
// stray leading "." when the left segment of a QualifiedName resolves
// to the empty string.
//
// Synthesized trees can contain empty or absent qualified components. A naive
// `left + "." + right` concatenation would yield `.Inner` for an empty left
// component. This factory-only case checks separator omission without parsing
// recovery input or exercising a downstream metadata map.
//
// 1. Build a QualifiedName whose Left is an Identifier created with "".
// 2. Call NodeText on the qualified node.
// 3. Assert the result is the right-hand text with no leading dot.
//
// @evidence contracts/testing.md#behavioral-verification NodeText omits separators for empty qualified components and returns empty when both components are empty.
// @evidence contracts/testing.md#independent-expectations Literal Inner, Outer and empty expectations independently specify each qualified-name recovery result.
// @evidence contracts/testing.md#distinguishing-cases Empty-left/right/both, nested empty interior/tail, and absent left/right controls distinguish stray separators, lost earlier components and unconditional right-only output.
// @evidence contracts/testing.md#execution-ownership All qualified nodes are built with the actual factory and passed directly to the shim in one existing Go unit case.
func TestNodeTextSkipsEmptyQualifiedLeft(t *testing.T) {
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  left := factory.NewIdentifier("")
  right := factory.NewIdentifier("Inner")
  qn := factory.NewQualifiedName(left, right)
  if got := shimast.NodeText(qn); got != "Inner" {
    t.Fatalf("NodeText(<empty>.Inner) = %q, want %q", got, "Inner")
  }

  for _, tc := range []struct{ left, right, want string }{{"Outer", "", "Outer"}, {"", "", ""}} {
    node := factory.NewQualifiedName(factory.NewIdentifier(tc.left), factory.NewIdentifier(tc.right))
    if got := shimast.NodeText(node); got != tc.want { t.Fatalf("NodeText(%q.%q) = %q, want %q", tc.left, tc.right, got, tc.want) }
  }

  nested := factory.NewQualifiedName(factory.NewIdentifier("Outer"), factory.NewIdentifier(""))
  nested = factory.NewQualifiedName(nested, factory.NewIdentifier("Inner"))
  nested = factory.NewQualifiedName(nested, factory.NewIdentifier(""))
  if got := shimast.NodeText(nested); got != "Outer.Inner" {
    t.Fatalf("nested empty component spelling = %q, want Outer.Inner", got)
  }
  for _, tc := range []struct{ node *shimast.Node; want string }{
    {factory.NewQualifiedName(nil, factory.NewIdentifier("Inner")), "Inner"},
    {factory.NewQualifiedName(factory.NewIdentifier("Outer"), nil), "Outer"},
    {factory.NewQualifiedName(nil, nil), ""},
  } {
    if got := shimast.NodeText(tc.node); got != tc.want {
      t.Fatalf("absent component spelling = %q, want %q", got, tc.want)
    }
  }
}
