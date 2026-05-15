package main

import "testing"

// TestEngineIndentCompoundsInsideGroup verifies an Indent inside a Group
// adds its width to every newline emitted by the broken group.
//
// Indent is how per-node printers express "this list level adds two
// columns of indentation". A regression here breaks the most basic
// readability invariant of a pretty printer — broken lists rendered
// flush against the left margin.
//
//  1. Build a Group whose contents are Hardline + Text wrapped in an
//     Indent of width 2 (default tabWidth).
//  2. Print under default options. The Group always breaks because of
//     the Hardline.
//  3. Assert the inner Text appears on its own line indented by 2
//     spaces.
func TestEngineIndentCompoundsInsideGroup(t *testing.T) {
  doc := Group(Indent(2, Hardline(), Text("inner")))
  got := Print(doc, DefaultPrintOptions())
  if got != "\n  inner" {
    t.Fatalf("indent compound mismatch: %q", got)
  }
}
