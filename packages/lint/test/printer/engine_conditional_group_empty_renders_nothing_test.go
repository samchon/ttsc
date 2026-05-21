package linthost

import "testing"

// TestEngineConditionalGroupEmptyRendersNothing verifies the engine
// treats an option-less ConditionalGroup as a layout no-op.
//
// A printer should never build an empty ConditionalGroup, but the
// engine's option loop reads `Children[len-1]` as the fallback; the
// length guard in front of it keeps a zero-option group from indexing
// out of range.
//
//  1. Build a ConditionalGroup with no options.
//  2. Print it.
//  3. Assert the output is empty.
func TestEngineConditionalGroupEmptyRendersNothing(t *testing.T) {
  got := Print(ConditionalGroup(), DefaultPrintOptions())
  if got != "" {
    t.Fatalf("empty conditional group: want empty string, got %q", got)
  }
}
