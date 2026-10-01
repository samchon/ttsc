package linthost

import (
  "testing"
)

// TestSourceHasStatementTerminatorSkipsTrailingWhitespace verifies that
// whitespace (spaces, tabs, newlines) after the `;` is stepped over
// correctly and the semicolon is still found.
//
// The backward scan skips `' '`, `'\t'`, `'\r'`, and `'\n'` before
// inspecting the next byte. When `end` lands inside trailing whitespace
// (the pattern TypeScript-Go uses when the ImportDeclaration's End()
// reaches past the `\n` into trivia), the scan must step back through
// that whitespace to locate the `;`. This test exercises the `i--; continue`
// whitespace branch by supplying an `end` that starts in the trailing
// newline rather than on the `;` itself.
//
//  1. Build a source string ending with `; \n` (semicolon then whitespace).
//  2. Call sourceHasStatementTerminator with end == len(src) so the scan
//     begins inside the trailing whitespace.
//  3. Assert the return value is true.
//
// @evidence contracts/testing.md#behavioral-verification sourceHasStatementTerminator must detect a semicolon followed by whitespace and LF.
// @evidence contracts/testing.md#independent-expectations The literal import ends semantically at its semicolon; trailing space and line break do not alter that spelling.
// @evidence contracts/testing.md#distinguishing-cases Whitespace suffix complements a bare terminator, balanced comment suffix and absence of a semicolon.
// @evidence contracts/testing.md#execution-ownership TestSourceHasStatementTerminatorSkipsTrailingWhitespace is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
func TestSourceHasStatementTerminatorSkipsTrailingWhitespace(t *testing.T) {
  src := "import { a } from \"x\"; \n"
  if !sourceHasStatementTerminator(src, len(src)) {
    t.Fatalf("expected true when whitespace follows ';', got false")
  }
}
