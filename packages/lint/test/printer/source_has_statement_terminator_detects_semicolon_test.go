package linthost

import (
  "testing"
)

// TestSourceHasStatementTerminatorDetectsSemicolon verifies that a source
// string whose last non-trivia character is `;` reports true.
//
// This is the primary success path of sourceHasStatementTerminator: the
// backward scan finds `;` immediately and returns true. Without this
// branch covered, the printer's decision to append a `;` token to the
// reconstructed import declaration is untested at the unit level.
//
// 1. Build a source string ending with a literal semicolon.
// 2. Call sourceHasStatementTerminator with end == len(src).
// 3. Assert the return value is true.
func TestSourceHasStatementTerminatorDetectsSemicolon(t *testing.T) {
  src := `import { a } from "x";`
  if !sourceHasStatementTerminator(src, len(src)) {
    t.Fatalf("expected true for source ending with ';', got false")
  }
}
