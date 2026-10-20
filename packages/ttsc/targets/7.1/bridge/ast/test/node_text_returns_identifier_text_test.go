package ast_test

import (
  "testing"

  shimast "github.com/microsoft/TypeScript/tsc/shim/ast"
)

// TestNodeTextReturnsIdentifierText verifies NodeText returns the
// identifier text when the node Kind already has an upstream Text() arm.
//
// Covers the Identifier delegated branch. Falling back to a source slice
// would lose Foo on a synthesized node without a source range. Other token
// kinds and downstream metadata consumers are not exercised by this case.
//
// 1. Construct a synthesised Identifier via NewIdentifier("Foo").
// 2. Call NodeText on it.
// 3. Assert the result is "Foo".
//
// @evidence contracts/testing.md#behavioral-verification NodeText returns the actual identifier payload for synthesized factory nodes without a source range.
// @evidence contracts/testing.md#independent-expectations Literal Foo and empty expectations fix token text independently of source slicing or another production text helper.
// @evidence contracts/testing.md#distinguishing-cases Named and empty synthesized identifiers distinguish payload forwarding from a source-range-only implementation or fabricated spelling.
// @evidence contracts/testing.md#execution-ownership The real factory and shim execute directly in the existing Go shim test process; no source-file or native-host fixture is needed.
func TestNodeTextReturnsIdentifierText(t *testing.T) {
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  id := factory.NewIdentifier("Foo")
  if got := shimast.NodeText(id); got != "Foo" {
    t.Fatalf("NodeText(Identifier) = %q, want %q", got, "Foo")
  }

  if got := shimast.NodeText(factory.NewIdentifier("")); got != "" {
    t.Fatalf("empty identifier = %q", got)
  }
}
