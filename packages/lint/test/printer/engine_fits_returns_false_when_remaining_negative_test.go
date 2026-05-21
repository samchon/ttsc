package linthost

import "testing"

// TestEngineFitsReturnsFalseWhenRemainingNegative verifies that fits
// immediately returns false when the remaining-column budget is already
// negative before examining any of the doc's content.
//
// StartingColumn can exceed PrintWidth in degenerate reflow scenarios
// (e.g. a node that begins past the right margin because its
// surrounding context already overflowed). In that case
// PrintWidth-StartingColumn is negative, and any group inside the node
// must break regardless of its flat width. The early-exit guard lets
// the caller pass a pre-computed negative remainder without forcing
// fits to walk the full doc tree looking for a text that overflows.
//
//  1. Call fits directly with a doc that would otherwise fit in
//     positive space (Text("x"), 1 column) but pass remaining=-1.
//  2. Assert fits returns false immediately.
func TestEngineFitsReturnsFalseWhenRemainingNegative(t *testing.T) {
  result := fits(Text("x"), -1, 0)
  if result != false {
    t.Fatalf("fits with remaining=-1: got true, want false")
  }
}
