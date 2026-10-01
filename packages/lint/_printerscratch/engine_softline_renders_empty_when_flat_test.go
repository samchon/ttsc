package linthost

import "testing"

// TestEngineSoftlineRendersEmptyWhenFlat verifies a Softline collapses
// to zero bytes when the surrounding group fits flat.
//
// Softline is what allows `[a, b]` to render with no space between `[`
// and the first element when the array fits on one line. If it ever
// rendered as a space (even erroneously), every flat array, object,
// and call would gain phantom leading whitespace.
//
//  1. Build a Group with `[`, Softline, `a`, `]`.
//  2. Print under printWidth=80.
//  3. Assert the result is `[a]` (no internal whitespace).
//
// @evidence contracts/testing.md#behavioral-verification Print must emit [a] without a space for the fitting Softline group.
// @evidence contracts/testing.md#independent-expectations Softline contributes zero bytes in flat mode, unlike Line; the literal retains bracket and payload order.
// @evidence contracts/testing.md#distinguishing-cases The fitting budget complements the narrow-budget newline Softline case.
// @evidence contracts/testing.md#execution-ownership TestEngineSoftlineRendersEmptyWhenFlat is a public Go unit entry selected with printer cases by TestSelectedLintUnits. It calls the Doc operation in the same Go test process, without a consumer install, native build or product host.
func TestEngineSoftlineRendersEmptyWhenFlat(t *testing.T) {
  doc := Group(Text("["), Softline(), Text("a"), Text("]"))
  got := Print(doc, DefaultPrintOptions())
  if got != "[a]" {
    t.Fatalf("softline-flat mismatch: %q", got)
  }
}
