package ast_test

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNodeTextSkipsEmptyQualifiedLeft verifies NodeText does not emit a
// stray leading "." when the left segment of a QualifiedName resolves
// to the empty string.
//
// Parser recovery (and synthesised trees) can produce a QualifiedName
// whose Left identifier carries empty text. A naive `left + "." + right`
// concatenation would yield `.Inner`, which downstream code (the typia
// metadata factory uses this as a map key) would treat as a distinct
// parameter name. The arm has to drop the empty segment instead.
//
// 1. Build a QualifiedName whose Left is an Identifier created with "".
// 2. Call NodeText on the qualified node.
// 3. Assert the result is the right-hand text with no leading dot.
//
// @evidence contracts/testing.md#behavioral-verification NodeText omits separators for empty qualified components and returns empty when both components are empty.
// @evidence contracts/testing.md#independent-expectations Literal Inner, Outer and empty expectations independently specify each qualified-name recovery result.
// @evidence contracts/testing.md#distinguishing-cases The original empty-left case plus empty-right and both-empty controls distinguish stray leading or trailing dots and unconditional right-only output.
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
}
