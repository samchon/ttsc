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
//
// @evidence contracts/testing.md#behavioral-verification sourceHasStatementTerminator must return false for empty source with end zero.
// @evidence contracts/testing.md#independent-expectations There is no character that could be a semicolon in the empty range.
// @evidence contracts/testing.md#distinguishing-cases Zero-length source is the lower boundary; nonempty absent and present terminators are checked separately.
// @evidence contracts/testing.md#execution-ownership TestSourceHasStatementTerminatorReturnsFalseForEmptyString is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
func TestSourceHasStatementTerminatorReturnsFalseForEmptyString(t *testing.T) {
  if sourceHasStatementTerminator("", 0) {
    t.Fatalf("expected false for empty source, got true")
  }
}
