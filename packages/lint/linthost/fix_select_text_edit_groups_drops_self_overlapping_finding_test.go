package linthost

import "testing"

// TestSelectTextEditGroupsDropsSelfOverlappingFinding verifies a finding whose
// own edits overlap each other applies nothing at all.
//
// The public `rule.TextEdit` contract tells a rule author that a finding's own
// edits must not overlap, and the reason is this: the group gate compares the
// selected count against the candidate count, so a finding that collides with
// itself can never be accepted. Without this case the contract's sharpest
// consequence for a rule author is unpinned, and a future selector that
// silently kept the surviving member would look correct.
//
//  1. Build one group whose two edits cover overlapping ranges.
//  2. Run selectTextEditGroups with that group alone.
//  3. Assert nothing is selected, not even the earlier-starting member.
//
// @evidence contracts/testing.md#behavioral-verification selectTextEditGroups rejects a group whose two nonidentical ranges overlap internally.
// @evidence contracts/testing.md#independent-expectations An empty selected result independently follows the all-or-nothing finding contract; keeping even the earlier edit fails.
// @evidence contracts/testing.md#distinguishing-cases Self-overlap is rejected, while identical duplicates are collapsed and wholly disjoint group members are accepted in companion cases.
// @evidence contracts/testing.md#execution-ownership TestSelectTextEditGroupsDropsSelfOverlappingFinding invokes selectTextEditGroups directly on its one contradictory group.
func TestSelectTextEditGroupsDropsSelfOverlappingFinding(t *testing.T) {
  group := []TextEdit{
    {Pos: 2, End: 6, Text: "FIRST"},
    {Pos: 4, End: 9, Text: "SECOND"},
  }
  selected := selectTextEditGroups(20, [][]TextEdit{group})
  if len(selected) != 0 {
    t.Fatalf("self-overlapping finding applied %d edits: %+v", len(selected), selected)
  }
}
