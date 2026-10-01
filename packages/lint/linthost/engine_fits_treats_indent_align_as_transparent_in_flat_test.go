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
//  1. Build `Group(Indent(4, Text("foo"), Line(), Text("bar")))` and the
//     same group with Align in place of Indent; each has flat width 7
//     (`foo bar`).
//  2. Print each under printWidth=10 — the budget exceeds 7 even before
//     accounting for Indent.
//  3. Assert both groups stay flat. A buggy fits() that charged the
//     Indent width would render broken (`foo\n    bar`).
//
// @evidence contracts/testing.md#behavioral-verification Print must render both the Indent-four group and the Align group as the flat foo bar under width ten, retaining both payloads and the single separating space.
// @evidence contracts/testing.md#independent-expectations The seven literal columns of foo bar fit within ten; Indent and Align change columns only after a broken separator, so the authored flat literal does not come from the measurement under test.
// @evidence contracts/testing.md#distinguishing-cases Flat Indent and flat Align are each asserted once; the broken indentation and dynamic-column cases are owned by the Indent and Align engine tests.
// @evidence contracts/testing.md#execution-ownership TestEngineFitsTreatsIndentAlignAsTransparentInFlat is one Go unit entry that renders literal Group docs holding an Indent and an Align with Print at PrintWidth 10 in-process; it parses no source and installs, builds and launches nothing.
func TestEngineFitsTreatsIndentAlignAsTransparentInFlat(t *testing.T) {
  opts := DefaultPrintOptions()
  opts.PrintWidth = 10
  indented := Group(Indent(4, Text("foo"), Line(), Text("bar")))
  if got := Print(indented, opts); got != "foo bar" {
    t.Fatalf("flat indent transparency mismatch: %q", got)
  }
  aligned := Group(Align(Text("foo"), Line(), Text("bar")))
  if got := Print(aligned, opts); got != "foo bar" {
    t.Fatalf("flat align transparency mismatch: %q", got)
  }
}
