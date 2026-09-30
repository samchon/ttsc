package ast_test

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNodeTextJoinsMultiHopQualifiedName verifies NodeText joins a
// multi-hop QualifiedName as "A.B.C".
//
// Locks the recursion in the QualifiedName arm. QualifiedName.Left is an
// *EntityName (Identifier OR QualifiedName), so a non-recursive
// implementation would silently drop everything but the final two
// segments — breaking dotted references like
// `IShoppingCoupon.IDirection.Inner` that show up in real-world JSDoc
// and type-argument positions.
//
// 1. Construct A.B then ((A.B).C) via NewQualifiedName.
// 2. Call NodeText on the outer node.
// 3. Assert the result is "A.B.C".
//
// @evidence contracts/testing.md#behavioral-verification NodeText recursively joins nested factory-built qualified names into A.B.C.
// @evidence contracts/testing.md#independent-expectations The literal A.B.C expectation fixes all three components independently of the recursive helper.
// @evidence contracts/testing.md#distinguishing-cases A three-component tree distinguishes recursion from joining only the outer pair or losing the first identifier.
// @evidence contracts/testing.md#execution-ownership The case calls the shim on actual factory nodes in the existing Go shim unit process; no consumer compiler or native host is run.
func TestNodeTextJoinsMultiHopQualifiedName(t *testing.T) {
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  a := factory.NewIdentifier("A")
  b := factory.NewIdentifier("B")
  c := factory.NewIdentifier("C")
  ab := factory.NewQualifiedName(a, b)
  abc := factory.NewQualifiedName(ab, c)
  if got := shimast.NodeText(abc); got != "A.B.C" {
    t.Fatalf("NodeText(A.B.C) = %q, want %q", got, "A.B.C")
  }
}
