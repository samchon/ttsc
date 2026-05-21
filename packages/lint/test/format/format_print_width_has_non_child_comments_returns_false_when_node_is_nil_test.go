package linthost

import "testing"

// TestFormatPrintWidthHasNonChildCommentsReturnsFalseWhenNodeIsNil verifies
// hasNonChildComments returns false immediately for a nil node without panicking.
//
// Locks the `if node == nil { return false }` guard at the top of
// hasNonChildComments. Without this guard, the subsequent ForEachChild call on
// a nil node would dereference a nil pointer and crash the dispatch loop.
//
//  1. Call hasNonChildComments(nil, "source", 0, 6).
//  2. Assert the return value is false and no panic occurred.
func TestFormatPrintWidthHasNonChildCommentsReturnsFalseWhenNodeIsNil(t *testing.T) {
  if got := hasNonChildComments(nil, "source", 0, 6); got {
    t.Fatalf("hasNonChildComments(nil, ...): want false, got true")
  }
}
