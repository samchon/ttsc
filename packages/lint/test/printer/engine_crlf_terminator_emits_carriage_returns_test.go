package main

import "testing"

// TestEngineCRLFTerminatorEmitsCarriageReturns verifies the EndOfLine
// option threads CRLF terminators into every newline the engine emits
// (Hardline, Softline-broken, Line-broken).
//
// Windows-origin codebases require CRLF preservation, and Prettier's
// `endOfLine: "crlf"` is the precedent. A regression that hard-coded
// "\n" would silently rewrite line endings on every reflow.
//
//  1. Build Group(Text("a"), Hardline(), Text("b")).
//  2. Print with EndOfLine="crlf".
//  3. Assert the boundary is `\r\n`.
func TestEngineCRLFTerminatorEmitsCarriageReturns(t *testing.T) {
  doc := Group(Text("a"), Hardline(), Text("b"))
  opts := DefaultPrintOptions()
  opts.EndOfLine = "crlf"
  got := Print(doc, opts)
  if got != "a\r\nb" {
    t.Fatalf("crlf mismatch: %q", got)
  }
}
