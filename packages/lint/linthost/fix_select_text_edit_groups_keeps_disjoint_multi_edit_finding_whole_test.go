package linthost

import "testing"

// TestSelectTextEditGroupsKeepsDisjointMultiEditFindingWhole is the positive
// twin of the drop-whole test: an authored valid multi-edit group whose edits
// are disjoint from the already-selected group must be selected in full.
//
// Without this arm, selectTextEditGroups could regress into rejecting every
// multi-edit group. This input pins acceptance of valid disjoint edits; it does
// not apply them or establish downstream rule convergence.
//
//  1. Group A is a single interior replace selected first.
//  2. Group B is a two-edit finding, both edits disjoint from A and each other.
//  3. Assert all three edits survive, sorted by position.
//
// @evidence contracts/testing.md#behavioral-verification selectTextEditGroups retains all three edits when both members of group B are disjoint from group A.
// @evidence contracts/testing.md#independent-expectations The independently authored ordered AA/BB/INS TextEdit list verifies all positions and payloads exactly.
// @evidence contracts/testing.md#distinguishing-cases A valid two-edit group including a zero-width insert must not be blanket rejected; collided and self-overlapping groups are separate negative twins.
// @evidence contracts/testing.md#execution-ownership TestSelectTextEditGroupsKeepsDisjointMultiEditFindingWhole owns this direct selectTextEditGroups call and complete element-by-element oracle.
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
