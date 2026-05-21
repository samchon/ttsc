package linthost

import (
  "testing"
)

// TestBlankLineBetweenStatementsReturnsFalseForOutOfRange verifies that
// blankLineBetweenStatements returns false when positions produce an invalid
// or inverted scan range.
//
// The guard `prevEnd < 0 || nextStart > len(src) || nextStart <= prevEnd`
// prevents the newline-scan loop from running on invalid ranges. Two
// triggerable cases: a negative prevEnd (which marks a position before the
// start of the source) and a nextPos that resolves to a position at or before
// prevEnd after trivia is skipped (an inverted range where the "next"
// statement starts no later than the "previous" statement ended). Returning
// false is the safe default: the block printer simply omits the extra
// Literalline rather than reading garbage.
//
//  1. Call blankLineBetweenStatements with prevEnd=-1 (negative prevEnd).
//  2. Call it with nextPos whose trivia-skipped result is before prevEnd.
//  3. Assert both calls return false.
func TestBlankLineBetweenStatementsReturnsFalseForOutOfRange(t *testing.T) {
  src := "a;\n\nb;\n"

  // Case 1: negative prevEnd triggers the first guard condition.
  if blankLineBetweenStatements(src, -1, 3) {
    t.Fatalf("expected false for negative prevEnd")
  }

  // Case 2: nextStart (after SkipTrivia) lands before prevEnd — an inverted
  // range. nextPos=1 → SkipTrivia returns 1 (no leading trivia at position 1),
  // prevEnd=5 → nextStart(1) <= prevEnd(5) → guard fires.
  if blankLineBetweenStatements(src, 5, 1) {
    t.Fatalf("expected false for nextStart <= prevEnd")
  }
}
