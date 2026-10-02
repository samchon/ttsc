package linthost

import "testing"

// TestEngineConditionalGroupFallsBackToLastOption verifies the engine
// renders the last ConditionalGroup option unconditionally when no
// earlier option fits the width budget.
//
// The final candidate is unconditional even when its literal text also
// exceeds the preferred width. The first fixture keeps the original fitting
// fallback; the second requires the over-wide final candidate to be retained.
//
// @evidence contracts/testing.md#behavioral-verification Print chooses the final literal candidate when earlier options exceed width ten, even if that final candidate is also over-wide.
// @evidence contracts/testing.md#independent-expectations The ordered-alternative contract makes authored fallback and fallback-too-wide final candidates unconditional; no renderer generates expected text.
// @evidence contracts/testing.md#distinguishing-cases A fitting final fallback and an over-wide final fallback distinguish unconditional final selection from filtering all alternatives by width; siblings cover first-fit order and zero alternatives.
// @evidence contracts/testing.md#execution-ownership TestEngineConditionalGroupFallsBackToLastOption is one Go unit entry that renders two independently authored two-option ConditionalGroups with Print at PrintWidth 10 in-process; it parses no source and installs, builds and launches nothing.
func TestEngineConditionalGroupFallsBackToLastOption(t *testing.T) {
  doc := ConditionalGroup(Text("this-option-is-too-wide"), Text("fallback"))
  opts := DefaultPrintOptions()
  opts.PrintWidth = 10
  got := Print(doc, opts)
  if got != "fallback" {
    t.Fatalf("conditional group fallback: want %q, got %q", "fallback", got)
  }
  doc = ConditionalGroup(Text("this-option-is-too-wide"), Text("fallback-too-wide"))
  got = Print(doc, opts)
  if got != "fallback-too-wide" {
    t.Fatalf("final fallback must survive its own width overflow: got %q", got)
  }
}
