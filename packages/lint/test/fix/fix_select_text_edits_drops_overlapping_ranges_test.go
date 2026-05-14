package main

import "testing"

// TestFixSelectTextEditsDropsOverlappingRanges verifies overlap policy.
//
// `selectTextEdits` is the gate that prevents two rule fixes from clobbering
// each other when their edit ranges intersect. The policy is "first one in
// sort order wins" so the function must drop any edit whose start sits before
// the previously-accepted edit's end.
//
// 1. Build two edits whose ranges overlap on a shared source position.
// 2. Run `selectTextEdits` against the synthetic source length.
// 3. Assert only the earlier-starting edit survives.
func TestFixSelectTextEditsDropsOverlappingRanges(t *testing.T) {
  edits := []TextEdit{
    {Pos: 0, End: 5, Text: "first"},
    {Pos: 3, End: 8, Text: "later"},
  }
  selected := selectTextEdits(10, edits)
  if len(selected) != 1 {
    t.Fatalf("expected 1 surviving edit, got %d (%+v)", len(selected), selected)
  }
  if selected[0].Pos != 0 || selected[0].End != 5 || selected[0].Text != "first" {
    t.Fatalf("unexpected surviving edit: %+v", selected[0])
  }
}
