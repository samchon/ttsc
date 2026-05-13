package main

import "testing"

// TestPositionOfESLintLocationClampsInvalidAndPastEnd verifies location edge cases.
//
// ESLint locations are one-based, but third-party rules can omit or underflow
// position fields. The converter clamps invalid coordinates and stops at the
// end of a physical line when the reported column runs past available text.
//
// This scenario extends the UTF-16 coverage with invalid line and column
// values plus carriage-return line termination.
//
// 1. Convert zero line and column values.
// 2. Convert a column beyond the end of a normal line.
// 3. Convert a column beyond a carriage return on the same line.
func TestPositionOfESLintLocationClampsInvalidAndPastEnd(t *testing.T) {
  if got := positionOfESLintLocation("alpha", 0, 0); got != 0 {
    t.Fatalf("invalid location should clamp to start, got %d", got)
  }
  if got := positionOfESLintLocation("alpha\nbeta", 2, 99); got != len("alpha\nbeta") {
    t.Fatalf("past-end column should clamp to text end, got %d", got)
  }
  if got := positionOfESLintLocation("alpha\rbeta", 1, 99); got != len("alpha") {
    t.Fatalf("carriage return should stop same-line scan, got %d", got)
  }
}
