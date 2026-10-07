package linthost

import (
  "testing"
)

// TestSourceHasStatementTerminatorSkipsTrailingWhitespace verifies that
// the authored space and LF after the `;` are stepped over
// correctly and the semicolon is still found.
//
// The backward scan skips `' '`, `'\t'`, `'\r'`, and `'\n'` before
// inspecting the next byte. This authored end position includes the space and
// LF, so the scan steps back through both to locate the semicolon. The direct
// call exercises the `i--; continue` branch without observing compiler End()
// positions or claiming an input cell for tab or CR.
//
//  1. Build a source string ending with `; \n` (semicolon then whitespace).
//  2. Call sourceHasStatementTerminator with end == len(src) so the scan
//     begins inside the trailing whitespace.
//  3. Assert the return value is true.
//
// @evidence contracts/testing.md#behavioral-verification sourceHasStatementTerminator must detect a semicolon followed by whitespace and LF.
// @evidence contracts/testing.md#independent-expectations The literal import ends semantically at its semicolon; trailing space and line break do not alter that spelling.
// @evidence contracts/testing.md#distinguishing-cases Whitespace suffix complements a bare terminator, balanced comment suffix and absence of a semicolon.
// @evidence contracts/testing.md#execution-ownership TestSourceHasStatementTerminatorSkipsTrailingWhitespace is one Go unit entry that calls the unexported sourceHasStatementTerminator on an authored import string followed by a space and LF in-process; it parses no source and installs, builds and launches nothing.
func TestSourceHasStatementTerminatorSkipsTrailingWhitespace(t *testing.T) {
  src := "import { a } from \"x\"; \n"
  if !sourceHasStatementTerminator(src, len(src)) {
    t.Fatalf("expected true when whitespace follows ';', got false")
  }
}
