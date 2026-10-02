package linthost

import "testing"

// TestEngineSoftlineRendersEmptyWhenFlat verifies a Softline collapses
// to zero bytes when the surrounding group fits flat.
//
// The authored fitting bracket group must retain its [a] bytes without the
// space an ordinary Line would add. This case observes the layout primitive
// directly; it does not dispatch an AST array, object or call printer.
//
// @evidence contracts/testing.md#behavioral-verification Print must emit [a] without a space for the fitting Softline group.
// @evidence contracts/testing.md#independent-expectations Softline contributes zero bytes in flat mode, unlike Line; the literal retains bracket and payload order.
// @evidence contracts/testing.md#distinguishing-cases The fitting budget complements the narrow-budget newline Softline case.
// @evidence contracts/testing.md#execution-ownership TestEngineSoftlineRendersEmptyWhenFlat is one Go unit entry that renders a literal Group holding one Softline with Print under default options in-process; it parses no source and installs, builds and launches nothing.
func TestEngineSoftlineRendersEmptyWhenFlat(t *testing.T) {
  doc := Group(Text("["), Softline(), Text("a"), Text("]"))
  got := Print(doc, DefaultPrintOptions())
  if got != "[a]" {
    t.Fatalf("softline-flat mismatch: %q", got)
  }
}
