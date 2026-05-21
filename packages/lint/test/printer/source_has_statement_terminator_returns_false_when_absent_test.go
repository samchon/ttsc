package linthost

import (
  "testing"
)

// TestSourceHasStatementTerminatorReturnsFalseWhenAbsent verifies that a
// source string without a trailing semicolon reports false.
//
// The printer must not emit a spurious `;` when the user omitted one.
// This test exercises the final `return false` branch of the backward
// scan, reached when the last non-trivia character is not `;` and not
// the start of a block comment.
//
//  1. Build a source string whose last meaningful character is `"` (end of
//     a module specifier with no semicolon).
//  2. Call sourceHasStatementTerminator with end == len(src).
//  3. Assert the return value is false.
func TestSourceHasStatementTerminatorReturnsFalseWhenAbsent(t *testing.T) {
  src := `import { a } from "x"`
  if sourceHasStatementTerminator(src, len(src)) {
    t.Fatalf("expected false for source without trailing ';', got true")
  }
}
