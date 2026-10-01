package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification Print must render a b~ and omit the broken-arm ! when the Group fits.
// @evidence contracts/testing.md#independent-expectations Three columns plus the flat ~ arm fit the default budget; the Doc contract specifies the second operand.
// @evidence contracts/testing.md#distinguishing-cases This flat-arm positive complements the narrow-budget broken-arm case.
// @evidence contracts/testing.md#execution-ownership TestEngineIfBreakPicksFlatBranchWhenGroupFits is a public Go unit entry selected with printer cases by TestSelectedLintUnits. It calls the Doc operation in the same Go test process, without a consumer install, native build or product host.
func TestEngineIfBreakPicksFlatBranchWhenGroupFits(t *testing.T) {
  doc := Group(Text("a"), Line(), Text("b"), IfBreak(Text("!"), Text("~")))
  got := Print(doc, DefaultPrintOptions())
  if got != "a b~" {
    t.Fatalf("ifbreak flat-arm mismatch: %q", got)
  }
}
