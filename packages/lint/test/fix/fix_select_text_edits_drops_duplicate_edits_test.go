package main

import "testing"

// TestFixSelectTextEditsDropsDuplicateEdits verifies dedup independent of overlap.
//
// selectTextEdits keeps the source single-pass deterministic by deduping
// byte-identical edits before the overlap filter runs. The dedup branch
// composes with sort stability, so a refactor that swaps the `seen` key
// shape or replaces the map with a position-only set must not change the
// surviving-edit count under identical inputs.
//
//  1. Build three edits where the first two are byte-identical and the third
//     targets a disjoint range.
//  2. Run `selectTextEdits` against a synthetic source length.
//  3. Assert exactly two edits survive and both ranges are accounted for.
func TestFixSelectTextEditsDropsDuplicateEdits(t *testing.T) {
  duplicate := TextEdit{Pos: 0, End: 3, Text: "let"}
  edits := []TextEdit{
    duplicate,
    duplicate,
    {Pos: 5, End: 8, Text: "var"},
  }
  selected := selectTextEdits(10, edits)
  if len(selected) != 2 {
    t.Fatalf("expected 2 surviving edits, got %d (%+v)", len(selected), selected)
  }
  if selected[0] != duplicate {
    t.Fatalf("expected first surviving edit to be the dedup'd entry, got %+v", selected[0])
  }
  if selected[1].Pos != 5 || selected[1].End != 8 || selected[1].Text != "var" {
    t.Fatalf("expected second surviving edit to be the disjoint entry, got %+v", selected[1])
  }
}
