package linthost

import (
  "testing"
)

// TestSourceHasStatementTerminatorDetectsSemicolon verifies that a source
// string whose last non-trivia character is `;` reports true.
//
// This is the primary success path of sourceHasStatementTerminator: the
// backward scan finds `;` immediately and returns true. Without this
// branch covered, this direct success case is missing. The test does not
// reconstruct an import declaration or observe the printer's output.
//
// 1. Build a source string ending with a literal semicolon.
// 2. Call sourceHasStatementTerminator with end == len(src).
// 3. Assert the return value is true.
//
// @evidence contracts/testing.md#behavioral-verification sourceHasStatementTerminator must recognize the semicolon at the end of an import source.
// @evidence contracts/testing.md#independent-expectations The literal terminal byte is a statement terminator under the supported source grammar.
// @evidence contracts/testing.md#distinguishing-cases A real terminal semicolon complements absent terminator and empty source cases.
// @evidence contracts/testing.md#execution-ownership TestSourceHasStatementTerminatorDetectsSemicolon is one Go unit entry that calls the unexported sourceHasStatementTerminator on an authored import string in-process; it parses no source and installs, builds and launches nothing.
func TestSourceHasStatementTerminatorDetectsSemicolon(t *testing.T) {
  src := `import { a } from "x";`
  if !sourceHasStatementTerminator(src, len(src)) {
    t.Fatalf("expected true for source ending with ';', got false")
  }
}
