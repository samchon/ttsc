package linthost

import "testing"

// TestEngineConditionalGroupPicksFirstFittingOption verifies the engine
// renders the first ConditionalGroup option whose opening line fits the
// remaining width budget.
//
// A fitting first candidate is retained over an over-wide fallback. A second
// fixture makes all three candidates fit, with a shorter middle candidate;
// literal first remains expected, distinguishing source order from choosing
// the shortest or final fitting candidate.
//
// @evidence contracts/testing.md#behavioral-verification Print must emit short over an over-wide fallback and retain first when later shorter and final alternatives also fit.
// @evidence contracts/testing.md#independent-expectations Five literal columns fit within ten. Authored first/x/last alternatives all fit, so source ordering independently requires first rather than the shortest or final candidate.
// @evidence contracts/testing.md#distinguishing-cases The first fixture distinguishes fitting from over-budget alternatives; the three-fit fixture distinguishes ordered first-fit selection from shortest-fit or last-fit policies.
// @evidence contracts/testing.md#execution-ownership TestEngineConditionalGroupPicksFirstFittingOption is one Go unit entry that renders independently authored two-option and three-option ConditionalGroups with Print at PrintWidth 10 in-process; it parses no source and installs, builds and launches nothing.
func TestEngineConditionalGroupPicksFirstFittingOption(t *testing.T) {
  doc := ConditionalGroup(Text("short"), Text("the-much-longer-fallback"))
  opts := DefaultPrintOptions()
  opts.PrintWidth = 10
  got := Print(doc, opts)
  if got != "short" {
    t.Fatalf("conditional group first option: want %q, got %q", "short", got)
  }
  doc = ConditionalGroup(Text("first"), Text("x"), Text("last"))
  got = Print(doc, opts)
  if got != "first" {
    t.Fatalf("several fitting alternatives must preserve first-fit order: got %q", got)
  }
}
