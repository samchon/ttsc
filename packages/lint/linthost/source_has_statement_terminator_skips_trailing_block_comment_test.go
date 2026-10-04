package linthost

import (
  "testing"
)

// TestSourceHasStatementTerminatorSkipsTrailingBlockComment verifies that a
// trailing block comment between the semicolon and the measured end position
// is walked past correctly, leaving the semicolon visible to the scan.
//
// The authored end position includes the trailing comment. Without the skip
// loop, the backward walk would stop at the closer and return false. This
// direct call covers the balanced-comment j-walk and its resume step; it
// does not observe compiler End() positions or reconstructed printer output.
//
//  1. Build a source string of the form `import { a } from "x";/* tail */`.
//  2. Call sourceHasStatementTerminator with end == len(src) so the scan
//     begins inside the trailing comment.
//  3. Assert the return value is true (semicolon found after skipping comment).
//
// @evidence contracts/testing.md#behavioral-verification sourceHasStatementTerminator must recover a semicolon before a balanced trailing block comment.
// @evidence contracts/testing.md#independent-expectations The literal contains a real terminator followed only by /* trailing comment */; the comment cannot cancel that terminator.
// @evidence contracts/testing.md#distinguishing-cases Balanced comment suffix complements the malformed closing-comment fragment and bare terminator cases.
// @evidence contracts/testing.md#execution-ownership TestSourceHasStatementTerminatorSkipsTrailingBlockComment is one Go unit entry that calls the unexported sourceHasStatementTerminator on an authored import string followed by a block comment in-process; it parses no source and installs, builds and launches nothing.
func TestSourceHasStatementTerminatorSkipsTrailingBlockComment(t *testing.T) {
  src := `import { a } from "x";/* trailing comment */`
  if !sourceHasStatementTerminator(src, len(src)) {
    t.Fatalf("expected true when ';' precedes a trailing block comment, got false")
  }
}
