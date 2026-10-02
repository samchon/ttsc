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
//  4. Call it over a gap holding two line breaks and over a gap holding one,
//     asserting true and false respectively, so the guard cannot be satisfied
//     by an implementation that always returns false.
//
// @evidence contracts/testing.md#behavioral-verification blankLineBetweenStatements must reject negative/reversed ranges while distinguishing two actual breaks from one.
// @evidence contracts/testing.md#independent-expectations Literal offsets two/four delimit the two LF bytes in a; followed by b;; the one-break source independently establishes the adjacent negative.
// @evidence contracts/testing.md#distinguishing-cases Negative prevEnd, reversed range, valid two-break gap and valid one-break gap pin safety and the blank-line threshold.
// @evidence contracts/testing.md#execution-ownership TestBlankLineBetweenStatementsReturnsFalseForOutOfRange is a plain top-level Go unit test, selectable with go test -run, that calls blankLineBetweenStatements directly on literal source strings and byte offsets, with no AST inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestBlankLineBetweenStatementsReturnsFalseForOutOfRange(t *testing.T) {
  src := "a;\n\nb;\n"

  // Case 1: negative prevEnd triggers the first guard condition.
  if blankLineBetweenStatements(src, -1, 3) {
    t.Fatalf("expected false for negative prevEnd")
  }

  // Case 2: nextStart (after SkipTrivia) lands before prevEnd: an inverted
  // range. nextPos=1 → SkipTrivia returns 1 (no leading trivia at position 1),
  // prevEnd=5 → nextStart(1) <= prevEnd(5) → guard fires.
  if blankLineBetweenStatements(src, 5, 1) {
    t.Fatalf("expected false for nextStart <= prevEnd")
  }
  if !blankLineBetweenStatements(src, 2, 4) {
    t.Fatal("two valid line breaks must preserve a blank line")
  }
  if blankLineBetweenStatements("a;\nb;\n", 2, 3) {
    t.Fatal("one line break is not a blank line")
  }
}
