package main

import "testing"

// TestPositionOfESLintLocationUsesUTF16Columns verifies ESLint location conversion.
//
// ESLint reports one-based lines and UTF-16 columns. The native renderer uses
// byte offsets in the source text, so surrogate-pair characters need explicit
// conversion before diagnostics are anchored.
//
// This scenario covers line clamping, newline traversal, and UTF-16 column
// accounting without spawning a JavaScript ESLint runtime.
//
// 1. Convert a second-line location to a byte offset.
// 2. Convert a location after an astral-plane character.
// 3. Assert both offsets point at the expected byte positions.
func TestPositionOfESLintLocationUsesUTF16Columns(t *testing.T) {
  if got := positionOfESLintLocation("a\nbeta", 2, 1); got != 2 {
    t.Fatalf("line offset mismatch: got %d", got)
  }
  if got := positionOfESLintLocation("a😀b", 1, 4); got != len("a😀") {
    t.Fatalf("utf16 offset mismatch: got %d", got)
  }
}
