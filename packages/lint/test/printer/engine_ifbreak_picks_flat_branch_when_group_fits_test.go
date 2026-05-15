package main

import "testing"

// TestEngineIfBreakPicksFlatBranchWhenGroupFits is the symmetric pair of
// the break-arm case: IfBreak must select its flat-mode argument when
// the group renders flat under the budget.
//
// The pair pins both decision arms; a regression that flipped one but
// not the other (e.g. always picking break) would slip past the
// break-only test. The fixture keeps every element narrow so a wide
// budget leaves the group in flat mode.
//
//  1. Build the same shape as the break case (Group + IfBreak).
//  2. Print under default printWidth=80 (group fits flat).
//  3. Assert the trailing token is `~` (the flat-mode arm).
func TestEngineIfBreakPicksFlatBranchWhenGroupFits(t *testing.T) {
  doc := Group(Text("a"), Line(), Text("b"), IfBreak(Text("!"), Text("~")))
  got := Print(doc, DefaultPrintOptions())
  if got != "a b~" {
    t.Fatalf("ifbreak flat-arm mismatch: %q", got)
  }
}
