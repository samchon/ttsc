package linthost

import "testing"

// TestSelectTextEditGroupsKeepsDisjointMultiEditFindingWhole is the positive
// twin of the drop-whole test: a multi-edit finding whose every edit is disjoint
// from the already-selected findings must apply in full, in one pass.
//
// Without this arm, selectTextEditGroups could regress into rejecting every
// multi-edit group (making noImportTypeSideEffects, trailing-comma batches, and
// the like never converge). Pinning the accept path proves the group gate only
// fires on a genuine collision.
//
//  1. Group A is a single interior replace selected first.
//  2. Group B is a two-edit finding, both edits disjoint from A and each other.
//  3. Assert all three edits survive, sorted by position.
func TestSelectTextEditGroupsKeepsDisjointMultiEditFindingWhole(t *testing.T) {
  groupA := []TextEdit{{Pos: 2, End: 4, Text: "AA"}}
  groupB := []TextEdit{
    {Pos: 6, End: 8, Text: "BB"},
    {Pos: 12, End: 12, Text: "INS"},
  }
  selected := selectTextEditGroups(20, [][]TextEdit{groupA, groupB})
  want := []TextEdit{
    {Pos: 2, End: 4, Text: "AA"},
    {Pos: 6, End: 8, Text: "BB"},
    {Pos: 12, End: 12, Text: "INS"},
  }
  if len(selected) != len(want) {
    t.Fatalf("expected all %d edits to survive, got %d: %+v", len(want), len(selected), selected)
  }
  for i, edit := range selected {
    if edit != want[i] {
      t.Fatalf("edit %d = %+v, want %+v (selected=%+v)", i, edit, want[i], selected)
    }
  }
}
