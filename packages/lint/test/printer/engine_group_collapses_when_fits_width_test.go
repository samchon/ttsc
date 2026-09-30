package linthost

import "testing"

// TestEngineGroupCollapsesWhenFitsWidth verifies a Group whose flat
// projection fits the remaining columns renders Lines as single spaces
// and Softlines as nothing.
//
// This is the fit branch of the fit-or-break decision. If it
// regressed, every "short call expression" would needlessly break
// across lines, producing diffs that look like a runaway formatter.
// The fixture sets a wide budget so the flat layout clearly wins.
//
//  1. Build a group with two Text fragments separated by Line.
//  2. Print under printWidth=80.
//  3. Assert the result is `foo bar` on a single line.
//
// @evidence contracts/testing.md#behavioral-verification Print must collapse the separator to a space and retain foo then bar under the default wide budget.
// @evidence contracts/testing.md#independent-expectations The literal seven-column foo bar follows the flat Group and Line contract.
// @evidence contracts/testing.md#distinguishing-cases This fitting branch complements the width-four broken rendering.
// @evidence contracts/testing.md#execution-ownership TestEngineGroupCollapsesWhenFitsWidth is a public Go unit entry selected with printer cases by TestSelectedLintUnits. It calls the Doc operation in the same Go test process, without a consumer install, native build or product host.
func TestEngineGroupCollapsesWhenFitsWidth(t *testing.T) {
  doc := Group(Text("foo"), Line(), Text("bar"))
  got := Print(doc, DefaultPrintOptions())
  if got != "foo bar" {
    t.Fatalf("flat group mismatch: %q", got)
  }
}
