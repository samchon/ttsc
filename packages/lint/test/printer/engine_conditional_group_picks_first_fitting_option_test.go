package linthost

import "testing"

// TestEngineConditionalGroupPicksFirstFittingOption verifies the engine
// renders the first ConditionalGroup option whose opening line fits the
// remaining width budget.
//
// ConditionalGroup is the primitive the hugged/exploded argument-list
// choice rests on. The engine must scan its options in order and commit
// to the first that fits, not the narrowest or the last.
//
//  1. Build a ConditionalGroup whose first option fits printWidth and
//     whose second is far wider.
//  2. Print it.
//  3. Assert the first option was rendered.
func TestEngineConditionalGroupPicksFirstFittingOption(t *testing.T) {
  doc := ConditionalGroup(Text("short"), Text("the-much-longer-fallback"))
  opts := DefaultPrintOptions()
  opts.PrintWidth = 10
  got := Print(doc, opts)
  if got != "short" {
    t.Fatalf("conditional group first option: want %q, got %q", "short", got)
  }
}
