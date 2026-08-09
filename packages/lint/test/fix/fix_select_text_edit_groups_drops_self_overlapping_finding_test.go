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
