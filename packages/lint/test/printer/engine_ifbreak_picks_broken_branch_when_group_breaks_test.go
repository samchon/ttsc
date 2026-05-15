package main

import "testing"

// TestEngineIfBreakPicksBrokenBranchWhenGroupBreaks verifies IfBreak
// switches between its broken-mode and flat-mode arguments based on the
// surrounding group's decision.
//
// IfBreak is the canonical trailing-comma primitive: emit `,` only
// when the list broke across lines. A regression that always picked
// one side would silently add or remove trailing commas in mismatched
// contexts. The fixture sets a tight budget so the surrounding group
// breaks, then asserts the broken arm of IfBreak is what reaches the
// output.
//
//  1. Build a Group containing `aaaa`, Line, `bbbb`, IfBreak(`!`, `~`).
//  2. Print under printWidth=4 (forces break).
//  3. Assert the trailing token is `!` (the break-mode arm).
func TestEngineIfBreakPicksBrokenBranchWhenGroupBreaks(t *testing.T) {
  doc := Group(Text("aaaa"), Line(), Text("bbbb"), IfBreak(Text("!"), Text("~")))
  opts := DefaultPrintOptions()
  opts.PrintWidth = 4
  got := Print(doc, opts)
  if got != "aaaa\nbbbb!" {
    t.Fatalf("ifbreak break-arm mismatch: %q", got)
  }
}
