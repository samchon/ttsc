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
//
// @evidence contracts/testing.md#behavioral-verification selectTextEdits keeps only one coincident EOF insertion, preserves an adjacent endpoint insertion and rejects invalid ranges.
// @evidence contracts/testing.md#independent-expectations The survivor must equal a supplied semicolon/newline edit and produce one of two full literal outputs; literal replacement/suffix edits specify the adjacency result.
// @evidence contracts/testing.md#distinguishing-cases Coincident inserts conflict, an insertion at a replacement end does not; negative start, reversed range and past-end range are rejected together.
// @evidence contracts/testing.md#execution-ownership TestFixSelectTextEditsDropsCoincidentZeroWidthInsert owns both direct selectTextEdits calls and the actual string splice in process.
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
  if selected[0] != edits[0] && selected[0] != edits[1] {
    t.Fatalf("selected an edit not supplied by either finding: %+v", selected[0])
  }
  if applied != "const x = 1;" && applied != "const x = 1\n" {
    t.Fatalf("survivor changed bytes outside its insertion: %q", applied)
  }
  adjacent := selectTextEdits(4, []TextEdit{
    {Pos: 2, End: 4, Text: "replacement"},
    {Pos: 4, End: 4, Text: "suffix"},
    {Pos: -1, End: 0, Text: "negative"},
    {Pos: 3, End: 2, Text: "reversed"},
    {Pos: 4, End: 5, Text: "past-end"},
  })
  if len(adjacent) != 2 || adjacent[0] != (TextEdit{Pos: 2, End: 4, Text: "replacement"}) || adjacent[1] != (TextEdit{Pos: 4, End: 4, Text: "suffix"}) {
    t.Fatalf("valid endpoint adjacency must survive while invalid ranges are rejected: %+v", adjacent)
  }
}
