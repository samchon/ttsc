package ast_test

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNodeTextReturnsIdentifierText verifies NodeText returns the
// identifier text when the node Kind already has an upstream Text() arm.
//
// Covers the delegated branch: for Kinds upstream supports (Identifier,
// StringLiteral, template parts, …), NodeText must forward to the
// upstream method verbatim. Falling back to the source slice would
// return "" for synthesised nodes that have no source range, breaking
// every factory-built tree we hand to the typia metadata factory.
//
// 1. Construct a synthesised Identifier via NewIdentifier("Foo").
// 2. Call NodeText on it.
// 3. Assert the result is "Foo".
func TestNodeTextReturnsIdentifierText(t *testing.T) {
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  id := factory.NewIdentifier("Foo")
  if got := shimast.NodeText(id); got != "Foo" {
    t.Fatalf("NodeText(Identifier) = %q, want %q", got, "Foo")
  }
}
