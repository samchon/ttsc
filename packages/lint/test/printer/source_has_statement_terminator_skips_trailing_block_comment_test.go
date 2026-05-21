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
func TestSourceHasStatementTerminatorSkipsTrailingBlockComment(t *testing.T) {
  src := `import { a } from "x";/* trailing comment */`
  if !sourceHasStatementTerminator(src, len(src)) {
    t.Fatalf("expected true when ';' precedes a trailing block comment, got false")
  }
}
