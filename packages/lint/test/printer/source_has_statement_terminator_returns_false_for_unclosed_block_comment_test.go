package linthost

import (
  "testing"
)

// TestSourceHasStatementTerminatorReturnsFalseForUnclosedBlockComment
// verifies that a `*/` fragment with no matching `/*` opener causes the
// helper to return false rather than panic or loop forever.
//
// The inner j-walk searches backwards for the `/*` open marker. When
// `j-1` drops below zero before finding it the helper concludes the
// source is malformed and returns false. This branch protects the caller
// from an infinite loop or out-of-bounds access on corrupted source
// slices — a realistic scenario when the printer receives a partial edit
// buffer rather than a complete file.
//
// 1. Build a minimal source string that ends with `*/` but has no `/*`.
// 2. Call sourceHasStatementTerminator with end == len(src).
// 3. Assert the return value is false (no valid comment opener found).
func TestSourceHasStatementTerminatorReturnsFalseForUnclosedBlockComment(t *testing.T) {
  // The source ends with `*/` but has no matching `/*` opener.
  src := `import { a } from "x"*/`
  if sourceHasStatementTerminator(src, len(src)) {
    t.Fatalf("expected false for unclosed block-comment fragment, got true")
  }
}
