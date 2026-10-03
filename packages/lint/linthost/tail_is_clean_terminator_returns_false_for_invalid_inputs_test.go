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
//  1. Call tailIsCleanTerminator with exprEnd=-1, with stmtEnd before
//     exprEnd and with stmtEnd past the end of the source (all three
//     out-of-range guards).
//  2. Call it with a gap containing `;;` (two semicolons).
//  3. Call it with a gap containing `/` (non-whitespace, not `;`).
//  4. Assert every one of those calls returns false.
//  5. Assert a single `;`, an empty gap and whitespace around one `;`
//     return true.
//
// @evidence contracts/testing.md#behavioral-verification tailIsCleanTerminator must reject a negative exprEnd, a stmtEnd before exprEnd, a stmtEnd past the source, a doubled semicolon and a comment-bearing gap, while admitting a lone semicolon, an empty gap and a space-tab-semicolon-CRLF gap.
// @evidence contracts/testing.md#independent-expectations The literal source strings and offsets fix each gap by hand: at most one semicolon and only space, tab, CR or LF is clean, while two semicolons or a slash are not; no expectation is read back from the function.
// @evidence contracts/testing.md#distinguishing-cases Three out-of-range offsets, a doubled terminator and a comment-bearing tail are rejected, and a one-semicolon gap, an empty gap and a mixed tab/CRLF gap are admitted.
// @evidence contracts/testing.md#execution-ownership TestTailIsCleanTerminatorReturnsFalseForInvalidInputs is one Go unit entry that calls the unexported tailIsCleanTerminator on authored source strings in-process; it parses no source and installs, builds and launches nothing.
func TestTailIsCleanTerminatorReturnsFalseForInvalidInputs(t *testing.T) {
  // Case 1: out-of-range offsets.
  if tailIsCleanTerminator("foo();", -1, 5) {
    t.Fatalf("expected false for negative exprEnd")
  }
  if tailIsCleanTerminator("foo();", 5, 4) {
    t.Fatalf("expected false when stmtEnd precedes exprEnd")
  }
  if tailIsCleanTerminator("foo();", 5, 7) {
    t.Fatalf("expected false when stmtEnd exceeds the source length")
  }

  // Case 2: two semicolons in the tail gap.
  // src = "foo();;", exprEnd=5, stmtEnd=7 → gap is ";;"
  src2 := "foo();;"
  if tailIsCleanTerminator(src2, 5, 7) {
    t.Fatalf("expected false for double-semicolon tail")
  }

  // Case 3: non-whitespace non-semicolon character in the tail gap.
  // src = "foo() /* */;", exprEnd=5, stmtEnd=12 → gap " /* */;" contains "/"
  src3 := "foo() /* */;"
  if tailIsCleanTerminator(src3, 5, len(src3)) {
    t.Fatalf("expected false for tail containing comment characters")
  }
  if !tailIsCleanTerminator("foo();", 5, 6) {
    t.Fatal("a single semicolon is a clean terminator")
  }
  if !tailIsCleanTerminator("foo()", 5, 5) {
    t.Fatal("an empty tail is clean")
  }
  if !tailIsCleanTerminator("foo() \t;\r\n", 5, len("foo() \t;\r\n")) {
    t.Fatal("whitespace around one semicolon is clean")
  }
}
