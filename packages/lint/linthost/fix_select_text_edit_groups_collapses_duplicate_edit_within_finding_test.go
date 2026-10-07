package linthost

import "testing"

// TestSelectTextEditGroupsCollapsesDuplicateEditWithinFinding verifies an authored
// edit group repeating the same edit still selects its distinct edits.
//
// This is the negative twin of the self-overlap case: an exact duplicate is not
// a conflict, so `dedupeTextEdits` collapses it before the group gate counts
// members. Without the collapse the duplicate would shrink the selected count
// below the candidate count and reject an otherwise valid fix, which is the
// difference between "your edits contradict each other" and "you repeated
// yourself".
//
//  1. Build one group whose first edit appears twice and whose second is disjoint.
//  2. Run selectTextEditGroups with that group alone.
//  3. Assert both distinct edits survive, in position order, with no duplicate.
//
// @evidence contracts/testing.md#behavioral-verification selectTextEditGroups collapses an exact duplicate within one group and retains both distinct edits in order.
// @evidence contracts/testing.md#independent-expectations The independent two-element TextEdit literal oracle verifies positions, ends and payloads rather than just the count.
// @evidence contracts/testing.md#distinguishing-cases An identical repeated edit is benign, unlike the self-overlap group that must be rejected entirely.
// @evidence contracts/testing.md#execution-ownership TestSelectTextEditGroupsCollapsesDuplicateEditWithinFinding calls selectTextEditGroups directly on one authored group in the Go unit process.
func TestSelectTextEditGroupsCollapsesDuplicateEditWithinFinding(t *testing.T) {
  group := []TextEdit{
    {Pos: 2, End: 4, Text: "AA"},
    {Pos: 2, End: 4, Text: "AA"},
    {Pos: 6, End: 8, Text: "BB"},
  }
  selected := selectTextEditGroups(20, [][]TextEdit{group})
  want := []TextEdit{
    {Pos: 2, End: 4, Text: "AA"},
    {Pos: 6, End: 8, Text: "BB"},
  }
  if len(selected) != len(want) {
    t.Fatalf("expected %d edits, got %d: %+v", len(want), len(selected), selected)
  }
  for i, edit := range selected {
    if edit != want[i] {
      t.Fatalf("edit %d = %+v, want %+v (selected=%+v)", i, edit, want[i], selected)
    }
  }
}
