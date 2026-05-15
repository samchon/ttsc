package main

import "testing"

// TestEngineHardlineForcesBreakRegardlessOfWidth verifies a Hardline
// inside a Group always emits a newline, even when the surrounding
// budget would happily fit the flat form.
//
// Hardline is the printer's commit-to-multiline signal. Per-node
// printers use it for declaration statements whose flat form (e.g.
// `if (a) b;`) is grammatically valid but stylistically wrong. If
// Hardline could be collapsed under a wide budget, every statement
// boundary would be at the mercy of width measurement.
//
//  1. Build a Group with `foo`, Hardline, `bar`.
//  2. Print under printWidth=80 (plenty of room).
//  3. Assert the Hardline produced a newline despite the slack.
func TestEngineHardlineForcesBreakRegardlessOfWidth(t *testing.T) {
  doc := Group(Text("foo"), Hardline(), Text("bar"))
  got := Print(doc, DefaultPrintOptions())
  if got != "foo\nbar" {
    t.Fatalf("hardline mismatch: %q", got)
  }
}
