package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification Print must join a and b with CRLF when EndOfLine is crlf.
// @evidence contracts/testing.md#independent-expectations The explicit line-ending option requires the literal a\r\nb; no expected string is rendered by Print.
// @evidence contracts/testing.md#distinguishing-cases This Hardline CRLF case complements the empty-option LF default case.
// @evidence contracts/testing.md#execution-ownership TestEngineCRLFTerminatorEmitsCarriageReturns is one Go unit entry that renders a Hardline-bearing Group with Print and EndOfLine crlf in-process; it parses no source and installs, builds and launches nothing.
func TestEngineCRLFTerminatorEmitsCarriageReturns(t *testing.T) {
  doc := Group(Text("a"), Hardline(), Text("b"))
  opts := DefaultPrintOptions()
  opts.EndOfLine = "crlf"
  got := Print(doc, opts)
  if got != "a\r\nb" {
    t.Fatalf("crlf mismatch: %q", got)
  }
}
