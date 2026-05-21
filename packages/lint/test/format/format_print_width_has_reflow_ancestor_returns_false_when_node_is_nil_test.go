package linthost

import "testing"

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
func TestFormatPrintWidthHasReflowAncestorReturnsFalseWhenNodeIsNil(t *testing.T) {
  if got := hasReflowAncestor(nil); got {
    t.Fatalf("hasReflowAncestor(nil): want false, got true")
  }
}
