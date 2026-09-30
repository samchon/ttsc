package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatPrintWidthHasReflowAncestorReturnsFalseWhenNodeIsNil verifies
// hasReflowAncestor returns false immediately for a nil node without panicking.
//
// Locks the `if node == nil { return false }` guard at the top of
// hasReflowAncestor. The guard exists because the parent-walk loop dereferences
// node.Parent on every iteration; without the early return a nil node would
// cause a nil-pointer dereference on the first loop access.
//
//  1. Call hasReflowAncestor(nil).
//  2. Assert the return value is false and no panic occurred.
//
// @evidence contracts/testing.md#behavioral-verification hasReflowAncestor must reject nil, unparented and non-reflow-only chains, and recognize a call ancestor beyond an intermediate statement.
// @evidence contracts/testing.md#independent-expectations Public parent links and independently chosen statement/call kinds encode the documented duplicate-reflow ownership rule; expected booleans do not repeat the ancestry walk.
// @evidence contracts/testing.md#distinguishing-cases Nil, empty ancestry, adjacent non-reflow parent and a qualifying grandparent distinguish safety, category and full-chain traversal.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthHasReflowAncestorReturnsFalseWhenNodeIsNil is selected as a public Go unit by TestSelectedLintUnits; its local cases call the owning operation in the shared process without a consumer install, native artifact build or product host.
func TestFormatPrintWidthHasReflowAncestorReturnsFalseWhenNodeIsNil(t *testing.T) {
  if got := hasReflowAncestor(nil); got {
    t.Fatalf("hasReflowAncestor(nil): want false, got true")
  }
  node := &shimast.Node{Kind: shimast.KindIdentifier}
  if hasReflowAncestor(node) {
    t.Fatal("an unparented node has no reflow ancestor")
  }
  node.Parent = &shimast.Node{Kind: shimast.KindExpressionStatement}
  if hasReflowAncestor(node) {
    t.Fatal("a non-reflow statement parent must not suppress its child")
  }
  node.Parent.Parent = &shimast.Node{Kind: shimast.KindCallExpression}
  if !hasReflowAncestor(node) {
    t.Fatal("a reflow call ancestor beyond a non-reflow parent must suppress duplicate child reflow")
  }
}
