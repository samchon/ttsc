package linthost

import "testing"

// TestEngineHardlineForcesBreakRegardlessOfWidth verifies a Hardline
// inside a Group always emits a newline, even when the surrounding
// budget would happily fit the flat form.
//
// Hardline is the printer's commit-to-multiline signal. Per-node
// printers use it for declaration statements whose flat form (e.g.
// `if (a) b;`) is grammatically valid but stylistically wrong. If
// Hardline could be collapsed under a wide budget, every statement
// boundary would be at the mercy of width measurement.
//
//  1. Build a Group with `foo`, Hardline, `bar`.
//  2. Print under printWidth=80 (plenty of room).
//  3. Assert the Hardline produced a newline despite the slack.
//
// @evidence contracts/testing.md#behavioral-verification Print must retain a newline between foo and bar inside a generously sized Group.
// @evidence contracts/testing.md#independent-expectations Hardline is unconditional in the Doc algebra, giving the literal foo\nbar.
// @evidence contracts/testing.md#distinguishing-cases An ample budget distinguishes Hardline from the ordinary Line fit case.
// @evidence contracts/testing.md#execution-ownership TestEngineHardlineForcesBreakRegardlessOfWidth is a public Go unit entry selected with printer cases by TestSelectedLintUnits. It calls the Doc operation in the same Go test process, without a consumer install, native build or product host.
func TestEngineHardlineForcesBreakRegardlessOfWidth(t *testing.T) {
  doc := Group(Text("foo"), Hardline(), Text("bar"))
  got := Print(doc, DefaultPrintOptions())
  if got != "foo\nbar" {
    t.Fatalf("hardline mismatch: %q", got)
  }
}
