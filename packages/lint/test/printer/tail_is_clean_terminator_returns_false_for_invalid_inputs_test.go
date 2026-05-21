package linthost

import (
  "testing"
)

// TestTailIsCleanTerminatorReturnsFalseForInvalidInputs verifies that
// tailIsCleanTerminator returns false for out-of-range positions, a gap
// containing two semicolons, and a gap containing a non-whitespace token.
//
// The function guards three distinct false cases: (1) out-of-range bounds
// prevent a slice panic; (2) two semicolons would produce double-semicolons
// if the caller re-minted the trailing `;`; (3) any character that is
// neither whitespace nor a single semicolon (e.g. a comment token `/`) means
// there is trivia in the gap that the printer cannot safely reproduce. All
// three must return false so the caller falls back to verbatim, preserving
// the original source rather than emitting corrupt output.
//
//  1. Call tailIsCleanTerminator with exprEnd=-1 (negative → out of range).
//  2. Call it with a gap containing `;;` (two semicolons).
//  3. Call it with a gap containing `/` (non-whitespace, not `;`).
//  4. Assert all three calls return false.
func TestTailIsCleanTerminatorReturnsFalseForInvalidInputs(t *testing.T) {
  // Case 1: out-of-range exprEnd.
  if tailIsCleanTerminator("foo();", -1, 5) {
    t.Fatalf("expected false for negative exprEnd")
  }

  // Case 2: two semicolons in the tail gap.
  // src = "foo();;", exprEnd=5, stmtEnd=7 → gap is ";;"
  src2 := "foo();;"
  if tailIsCleanTerminator(src2, 5, 7) {
    t.Fatalf("expected false for double-semicolon tail")
  }

  // Case 3: non-whitespace non-semicolon character in the tail gap.
  // src = "foo() /* */ ;", exprEnd=5, stmtEnd=12 → gap contains "/"
  src3 := "foo() /* */;"
  if tailIsCleanTerminator(src3, 5, len(src3)) {
    t.Fatalf("expected false for tail containing comment characters")
  }
}
