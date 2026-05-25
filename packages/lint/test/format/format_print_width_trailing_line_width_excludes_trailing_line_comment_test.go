package linthost

import "testing"

// TestFormatPrintWidthTrailingLineWidthExcludesTrailingLineComment
// verifies trailingLineWidth stops at a `//` line comment instead of
// charging the comment bytes against the suffix budget.
//
// A `//` line comment runs to the end of the source line by definition,
// so the rule cannot move or wrap it. Counting its bytes as un-movable
// suffix width over-shrinks the layout budget on the rule's shrunk
// re-render and forces a flat-fitting call to break (Prettier 3 keeps
// the call inline in that shape — see the typeorm `replaceAll(...) //
// Null bytes' regression that pushed `formatPrintWidth: 'off'` onto
// the ttsc-lint benchmark branch). The exclusion lives in the helper
// because the same accounting needs to flow through both the fast-path
// budget check and the shrunk-budget re-render.
//
//  1. Call trailingLineWidth across a `;` + trailing line comment.
//  2. Assert the returned width covers only the un-movable `;`.
//  3. Spot-check a leading-whitespace + comment case to lock the
//     trimming branch.
func TestFormatPrintWidthTrailingLineWidthExcludesTrailingLineComment(t *testing.T) {
  if got := trailingLineWidth("; // trailing\n", 0, 2); got != 1 {
    t.Fatalf("semi + line comment: want 1, got %d", got)
  }
  if got := trailingLineWidth("   // only a comment\n", 0, 2); got != 0 {
    t.Fatalf("whitespace + line comment: want 0, got %d", got)
  }
}
