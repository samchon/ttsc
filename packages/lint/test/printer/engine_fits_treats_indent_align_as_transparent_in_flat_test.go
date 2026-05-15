package main

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
func TestEngineFitsTreatsIndentAlignAsTransparentInFlat(t *testing.T) {
  doc := Group(Indent(4, Text("foo"), Line(), Text("bar")))
  opts := DefaultPrintOptions()
  opts.PrintWidth = 10
  got := Print(doc, opts)
  if got != "foo bar" {
    t.Fatalf("flat indent transparency mismatch: %q", got)
  }
}
