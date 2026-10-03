package linthost

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContribAdapterToInternalTextEditsRoundTripsThreeEdits verifies the
// rule.TextEdit to linthost.TextEdit conversion at
// contrib_adapter.go::toInternalTextEdits.
//
// The adapter copies contributor edit fields into the engine's edit records.
// Three distinct edits expose truncation, reordering and field loss in this
// conversion without relying on a contributor process or an applied rewrite.
//
// 1. Build a rule.TextEdit slice with three distinct, non-overlapping edits.
// 2. Call `toInternalTextEdits` directly.
// 3. Assert each field round-trips and order is preserved.
//
// @evidence contracts/testing.md#behavioral-verification Actual adapter conversion preserves all Pos, End and Text fields and original order for three authored public edits, including a zero-width insertion.
// @evidence contracts/testing.md#independent-expectations Literal 0..1 a, 5..7 bc and 12..12 insert inputs define each expected converted edit independently of the converter; every field and cardinality is compared.
// @evidence contracts/testing.md#distinguishing-cases Distinct coordinates and replacements distinguish reorder, truncation and field loss; zero-width insertion contrasts with replacements, and sibling nil/empty units own absence behavior.
// @evidence contracts/testing.md#execution-ownership The actual public-to-internal conversion executes directly in-process; no native contributor producer, CLI invocation, installation or repository inspection supplies the result.
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
