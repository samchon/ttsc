package linthost

import "testing"

// TestFixSelectTextEditsDropsCoincidentZeroWidthInsert verifies that two
// zero-width inserts at the same offset cannot both survive selection.
//
// Two rules can each emit a zero-width insert at the identical offset in one
// pass (e.g. `format/semi` inserting `;` and `format/whitespace` inserting
// `\n` at EOF of `const x = 1`). Both pass the `edit.Pos < lastEnd` overlap
// gate, then apply in reverse sort order and concatenate at one point —
// silently producing the corrupt `const x = 1\n;`. The host contract is one
// winner per overlapping group, so selection must drop the second insert and
// let the next fix pass re-emit the survivor cleanly.
//
//  1. Build two coincident zero-width inserts at the EOF offset of `const x = 1`,
//     one `;` and one `\n`.
//  2. Run `selectTextEdits` against the source length.
//  3. Assert exactly one edit survives and applying it never yields `\n;`.
func TestFixSelectTextEditsDropsCoincidentZeroWidthInsert(t *testing.T) {
  const source = "const x = 1"
  edits := []TextEdit{
    {Pos: len(source), End: len(source), Text: ";"},
    {Pos: len(source), End: len(source), Text: "\n"},
  }
  selected := selectTextEdits(len(source), edits)
  if len(selected) != 1 {
    t.Fatalf("expected 1 surviving edit, got %d (%+v)", len(selected), selected)
  }
  applied := source[:selected[0].Pos] + selected[0].Text + source[selected[0].End:]
  if applied == "const x = 1\n;" {
    t.Fatalf("selection produced the dangling-semicolon corruption: %q", applied)
  }
}
