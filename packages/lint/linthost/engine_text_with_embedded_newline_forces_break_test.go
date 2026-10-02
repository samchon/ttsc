package linthost

import "testing"

// TestEngineTextWithEmbeddedNewlineForcesBreak verifies that a multiline
// Text makes its directly enclosing Group break the following Line.
//
// The literal a\nb payload already contains a newline. Under the wide
// default width of 80, the expected a\nb\nc preserves those bytes and
// distinguishes a broken following Line from a flat separating space.
// This direct Doc fixture does not exercise parsed source or certify
// every enclosing wrapper or ancestor layout.
//
// @evidence contracts/testing.md#behavioral-verification Print must break the following Line after the already multiline a\nb payload.
// @evidence contracts/testing.md#independent-expectations A multiline Text cannot have a single-line flat projection; the literal a\nb\nc retains payload order.
// @evidence contracts/testing.md#distinguishing-cases A wide budget ensures the newline, rather than text length, forces the break.
// @evidence contracts/testing.md#execution-ownership TestEngineTextWithEmbeddedNewlineForcesBreak is one Go unit entry that renders a literal Group holding a multiline Text and a Line with Print under default options in-process; it parses no source and installs, builds and launches nothing.
func TestEngineTextWithEmbeddedNewlineForcesBreak(t *testing.T) {
  doc := Group(Text("a\nb"), Line(), Text("c"))
  got := Print(doc, DefaultPrintOptions())
  if got != "a\nb\nc" {
    t.Fatalf("expected broken group with newline between b and c, got %q", got)
  }
}
