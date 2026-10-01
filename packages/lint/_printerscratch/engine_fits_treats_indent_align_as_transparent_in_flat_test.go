package linthost

import "testing"

// TestEngineFitsTreatsIndentAlignAsTransparentInFlat verifies the
// `fits()` measurement walks through `Indent` and `Align` wrappers
// transparently when their group is in flat mode.
//
// `Indent` and `Align` only contribute columns to *broken* mode;
// their flat projection is identical to their children's. The
// measurement code in `print_engine.go` relies on this invariant
// without an explicit test pinning it. A refactor that started
// charging the Indent width against the flat budget would silently
// flip groups to broken at narrower widths than necessary,
// producing diffs that look like a rogue width regression.
//
//  1. Build `Group(Indent(4, Text("foo"), Line(), Text("bar")))`
//     whose flat width is 7 (`foo bar`).
//  2. Print under printWidth=10 — the budget exceeds 7 even before
//     accounting for Indent.
//  3. Assert the group stays flat. A buggy fits() that charged the
//     Indent width would render broken (`foo\n    bar`).
//
// @evidence contracts/testing.md#behavioral-verification Print must preserve the flat foo bar output despite Indent four under width ten.
// @evidence contracts/testing.md#independent-expectations The seven literal columns fit; Indent adds columns only after a broken separator.
// @evidence contracts/testing.md#distinguishing-cases Flat indentation neutrality complements the broken indentation case. The fixture exercises Indent, not an Align operand despite the historical name.
// @evidence contracts/testing.md#execution-ownership TestEngineFitsTreatsIndentAlignAsTransparentInFlat is a public Go unit entry selected with printer cases by TestSelectedLintUnits. It calls the Doc operation in the same Go test process, without a consumer install, native build or product host.
func TestEngineFitsTreatsIndentAlignAsTransparentInFlat(t *testing.T) {
  doc := Group(Indent(4, Text("foo"), Line(), Text("bar")))
  opts := DefaultPrintOptions()
  opts.PrintWidth = 10
  got := Print(doc, opts)
  if got != "foo bar" {
    t.Fatalf("flat indent transparency mismatch: %q", got)
  }
}
