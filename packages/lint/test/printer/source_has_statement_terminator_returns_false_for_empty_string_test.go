package linthost

import (
  "testing"
)

// TestSourceHasStatementTerminatorReturnsFalseForEmptyString verifies that
// an empty source and an end position of zero return false without panicking.
//
// When `end == 0`, the loop starts at `i = -1` which is already below zero,
// so the loop body never executes and the function falls through to the
// final `return false`. This edge case exercises the loop's boundary
// condition to ensure no off-by-one panic occurs on empty or zero-length
// sources.
//
// 1. Call sourceHasStatementTerminator with an empty string and end == 0.
// 2. Assert the return value is false.
func TestSourceHasStatementTerminatorReturnsFalseForEmptyString(t *testing.T) {
  if sourceHasStatementTerminator("", 0) {
    t.Fatalf("expected false for empty source, got true")
  }
}
