package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification selectTextEdits keeps the earlier-starting first edit and drops a later intersecting range.
// @evidence contracts/testing.md#independent-expectations The literal [0,5) first payload oracle independently identifies the winner rather than accepting any one-edit result.
// @evidence contracts/testing.md#distinguishing-cases Two ranges overlap; the adjacent endpoint and distinct-range cases supply the nonconflicting boundaries.
// @evidence contracts/testing.md#execution-ownership TestFixSelectTextEditsDropsOverlappingRanges calls selectTextEdits once and checks its actual surviving edit.
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
