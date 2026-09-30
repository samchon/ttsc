package linthost

import (
  "testing"
)

// TestSourceHasStatementTerminatorSkipsTrailingBlockComment verifies that a
// trailing block comment between the semicolon and the measured end position
// is walked past correctly, leaving the semicolon visible to the scan.
//
// TypeScript-Go's statement End() can reach past a trailing comment that
// sits after the `;`. Without the block-comment skip loop, the backward
// walk would stop at the `*/` byte and return false, causing the printer
// to drop the semicolon from the reconstructed import declaration. This
// test covers the entire block-comment skip branch including the inner
// j-walk and the `i = j - 2` resume step.
//
//  1. Build a source string of the form `import { a } from "x";/* tail */`.
//  2. Call sourceHasStatementTerminator with end == len(src) so the scan
//     begins inside the trailing comment.
//  3. Assert the return value is true (semicolon found after skipping comment).
//
// @evidence contracts/testing.md#behavioral-verification sourceHasStatementTerminator must recover a semicolon before a balanced trailing block comment.
// @evidence contracts/testing.md#independent-expectations The literal contains a real terminator followed only by /* trailing comment */; the comment cannot cancel that terminator.
// @evidence contracts/testing.md#distinguishing-cases Balanced comment suffix complements the malformed closing-comment fragment and bare terminator cases.
// @evidence contracts/testing.md#execution-ownership TestSourceHasStatementTerminatorSkipsTrailingBlockComment is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
func TestSourceHasStatementTerminatorSkipsTrailingBlockComment(t *testing.T) {
  src := `import { a } from "x";/* trailing comment */`
  if !sourceHasStatementTerminator(src, len(src)) {
    t.Fatalf("expected true when ';' precedes a trailing block comment, got false")
  }
}
