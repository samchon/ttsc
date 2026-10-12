package ast_test

import (
  "testing"

  shimast "github.com/microsoft/TypeScript/tsc/shim/ast"
)

// TestNodeTextReturnsEmptyForNil verifies NodeText returns "" for a nil node.
//
// Locks the nil guard and distinguishes nil from an identifier payload. This
// does not establish totality for arbitrary malformed node data or cyclic
// qualified-name graphs, nor execute a caller's missing-name filtering policy.
//
// 1. Call NodeText(nil).
// 2. Assert the result is "".
//
// @evidence contracts/testing.md#behavioral-verification NodeText handles a nil node without dereferencing it and leaves real identifier text available.
// @evidence contracts/testing.md#independent-expectations Literal empty and Present expectations distinguish absence from a real named node.
// @evidence contracts/testing.md#distinguishing-cases The nil input tests the nil guard and the identifier positive control rejects an unconditional empty result. Arbitrary malformed nodes and cycles are not exercised.
// @evidence contracts/testing.md#execution-ownership Both calls use the actual shim in the existing Go unit process without parsing or launching a consumer compiler.
func TestNodeTextReturnsEmptyForNil(t *testing.T) {
  if got := shimast.NodeText(nil); got != "" {
    t.Fatalf("NodeText(nil) = %q, want %q", got, "")
  }

  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  if got := shimast.NodeText(factory.NewIdentifier("Present")); got != "Present" {
    t.Fatalf("identifier control = %q", got)
  }
}
