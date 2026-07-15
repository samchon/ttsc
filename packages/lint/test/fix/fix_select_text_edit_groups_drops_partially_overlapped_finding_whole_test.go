package linthost

import "testing"

// TestSelectTextEditGroupsDropsPartiallyOverlappedFindingWhole verifies the
// per-finding-atomic applier drops an entire multi-edit finding when only one
// of its edits overlaps an already-selected finding.
//
// This is the core of samchon/ttsc#605: the old flat selector kept a finding's
// non-overlapping edits while silently dropping the one that collided, emitting
// a half-applied fix (e.g. `import type { type A }`). selectTextEditGroups must
// instead reject the whole group so the finding re-fires on the next cascade
// pass.
//
//  1. Group A is a single interior replace that is selected first (earlier start).
//  2. Group B is a two-edit finding: one edit overlaps A, one is far away and
//     disjoint from everything.
//  3. Assert only A survives and NEITHER member of B is applied — proving the
//     drop is whole-group, not per-edit.
func TestSelectTextEditGroupsDropsPartiallyOverlappedFindingWhole(t *testing.T) {
  groupA := []TextEdit{{Pos: 2, End: 4, Text: "AA"}}
  groupB := []TextEdit{
    {Pos: 3, End: 6, Text: "OVERLAP"},    // overlaps groupA's [2,4)
    {Pos: 12, End: 12, Text: "DISJOINT"}, // disjoint zero-width insert
  }
  selected := selectTextEditGroups(20, [][]TextEdit{groupA, groupB})
  if len(selected) != 1 {
    t.Fatalf("expected only group A to survive, got %d edits: %+v", len(selected), selected)
  }
  if selected[0] != (TextEdit{Pos: 2, End: 4, Text: "AA"}) {
    t.Fatalf("unexpected surviving edit: %+v", selected[0])
  }
  for _, edit := range selected {
    if edit == groupB[1] {
      t.Fatalf("group B's disjoint edit leaked despite its sibling overlapping: %+v", edit)
    }
  }
}
