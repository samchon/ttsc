package ast_test

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNodeTextReturnsEmptyForNil verifies NodeText returns "" for a nil node.
//
// Locks the nil-guard at the top of NodeText. The helper is a total function
// over *Node — typia's JSDoc parameter-name extractor calls it without
// checking — so a nil-deref here would be a behaviour change for every
// caller. The empty-string contract is the only signal that lets callers
// skip "no parameter name" entries cleanly.
//
// 1. Call NodeText(nil).
// 2. Assert the result is "".
//
// @evidence contracts/testing.md#behavioral-verification NodeText handles a nil node without dereferencing it and leaves real identifier text available.
// @evidence contracts/testing.md#independent-expectations Literal empty and Present expectations distinguish absence from a real named node.
// @evidence contracts/testing.md#distinguishing-cases The nil input tests the total-function guard and the identifier positive control rejects an unconditional empty result.
// @evidence contracts/testing.md#execution-ownership Both calls use the actual shim in the existing Go unit process without parsing or launching a consumer compiler.
func TestNodeTextReturnsEmptyForNil(t *testing.T) {
  if got := shimast.NodeText(nil); got != "" {
    t.Fatalf("NodeText(nil) = %q, want %q", got, "")
  }

  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  if got := shimast.NodeText(factory.NewIdentifier("Present")); got != "Present" { t.Fatalf("identifier control = %q", got) }
}
