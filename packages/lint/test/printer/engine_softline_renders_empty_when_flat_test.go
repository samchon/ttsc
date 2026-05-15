package main

import "testing"

// TestEngineSoftlineRendersEmptyWhenFlat verifies a Softline collapses
// to zero bytes when the surrounding group fits flat.
//
// Softline is what allows `[a, b]` to render with no space between `[`
// and the first element when the array fits on one line. If it ever
// rendered as a space (even erroneously), every flat array, object,
// and call would gain phantom leading whitespace.
//
//  1. Build a Group with `[`, Softline, `a`, `]`.
//  2. Print under printWidth=80.
//  3. Assert the result is `[a]` (no internal whitespace).
func TestEngineSoftlineRendersEmptyWhenFlat(t *testing.T) {
  doc := Group(Text("["), Softline(), Text("a"), Text("]"))
  got := Print(doc, DefaultPrintOptions())
  if got != "[a]" {
    t.Fatalf("softline-flat mismatch: %q", got)
  }
}
