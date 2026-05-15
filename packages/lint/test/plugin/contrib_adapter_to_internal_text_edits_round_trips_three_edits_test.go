package main

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContribAdapterToInternalTextEditsRoundTripsThreeEdits verifies the
// rule.TextEdit → main.TextEdit conversion at
// contrib_adapter.go::toInternalTextEdits.
//
// The adapter is the single point where contributor types are widened to
// the engine's internal types. A bug in the loop (off-by-one, reordering,
// or field drop) would silently misapply contributor fixes; no other test
// in the corpus exercises the conversion in isolation. Three edits are
// enough to surface order regressions while staying small.
//
// 1. Build a rule.TextEdit slice with three distinct, non-overlapping edits.
// 2. Call `toInternalTextEdits` directly.
// 3. Assert each field round-trips and order is preserved.
func TestContribAdapterToInternalTextEditsRoundTripsThreeEdits(t *testing.T) {
  input := []rule.TextEdit{
    {Pos: 0, End: 1, Text: "a"},
    {Pos: 5, End: 7, Text: "bc"},
    {Pos: 12, End: 12, Text: "insert"},
  }
  got := toInternalTextEdits(input)
  if len(got) != len(input) {
    t.Fatalf("length mismatch: want %d, got %d", len(input), len(got))
  }
  for i, edit := range input {
    if got[i].Pos != edit.Pos || got[i].End != edit.End || got[i].Text != edit.Text {
      t.Fatalf("edit[%d] mismatch: want %+v, got %+v", i, edit, got[i])
    }
  }
}
