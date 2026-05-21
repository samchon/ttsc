package linthost

import "testing"

// TestEngineConditionalGroupFallsBackToLastOption verifies the engine
// renders the last ConditionalGroup option unconditionally when no
// earlier option fits the width budget.
//
// The last option is the safe fallback — the exploded argument list for
// a call. The engine must use it even though it never measured it,
// otherwise an over-wide call would render nothing.
//
//  1. Build a ConditionalGroup whose only non-final option overflows
//     printWidth.
//  2. Print it.
//  3. Assert the final fallback option was rendered.
func TestEngineConditionalGroupFallsBackToLastOption(t *testing.T) {
  doc := ConditionalGroup(Text("this-option-is-too-wide"), Text("fallback"))
  opts := DefaultPrintOptions()
  opts.PrintWidth = 10
  got := Print(doc, opts)
  if got != "fallback" {
    t.Fatalf("conditional group fallback: want %q, got %q", "fallback", got)
  }
}
