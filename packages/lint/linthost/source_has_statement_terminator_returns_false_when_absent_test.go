package linthost

import (
  "testing"
)

// TestSourceHasStatementTerminatorReturnsFalseWhenAbsent verifies that a
// source string without a trailing semicolon reports false.
//
// The printer must not emit a spurious `;` when the user omitted one.
// This test exercises the in-loop `return false` branch of the backward
// scan: the terminal quote is neither `;` nor a trailing block-comment closer.
// Printer output is not observed by this direct predicate call.
//
//  1. Build a source string whose last meaningful character is `"` (end of
//     a module specifier with no semicolon).
//  2. Call sourceHasStatementTerminator with end == len(src).
//  3. Assert the return value is false.
//
// @evidence contracts/testing.md#behavioral-verification sourceHasStatementTerminator must return false when the import source has no terminal semicolon.
// @evidence contracts/testing.md#independent-expectations The literal ends at the module string and contains no trailing terminator; source spelling independently fixes the result.
// @evidence contracts/testing.md#distinguishing-cases The same import with a terminal semicolon is the adjacent positive sibling.
// @evidence contracts/testing.md#execution-ownership TestSourceHasStatementTerminatorReturnsFalseWhenAbsent is one Go unit entry that calls the unexported sourceHasStatementTerminator on an authored semicolon-less import string in-process; it parses no source and installs, builds and launches nothing.
func TestSourceHasStatementTerminatorReturnsFalseWhenAbsent(t *testing.T) {
  src := `import { a } from "x"`
  if sourceHasStatementTerminator(src, len(src)) {
    t.Fatalf("expected false for source without trailing ';', got true")
  }
}
