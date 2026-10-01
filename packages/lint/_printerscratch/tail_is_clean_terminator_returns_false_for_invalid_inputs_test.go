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
//
// @evidence contracts/testing.md#behavioral-verification tailIsCleanTerminator must reject invalid ranges, duplicate semicolons and comments while admitting empty or whitespace-plus-single-semicolon tails.
// @evidence contracts/testing.md#independent-expectations The literal byte ranges independently show zero/one permitted semicolon versus two and nonwhitespace comment characters.
// @evidence contracts/testing.md#distinguishing-cases Negative range, doubled terminator, comment-bearing tail, one terminator, empty tail and mixed CRLF/tab whitespace distinguish every decision this matrix owns.
// @evidence contracts/testing.md#execution-ownership TestTailIsCleanTerminatorReturnsFalseForInvalidInputs is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
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
