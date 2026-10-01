package linthost

import "testing"

// TestEngineTextWithEmbeddedNewlineForcesBreak verifies a Text whose
// payload spans multiple lines forces every enclosing Group into
// broken mode regardless of the column budget.
//
// The flat form of such a Text is multi-line by definition: it
// already contains the newline that the engine is asking
// "can this fit on one line?" about. A regression that returned
// `true` from `fits()` on multi-line Text would let surrounding
// groups commit to flat layouts whose rendered output already had
// newlines embedded — the resulting flat-but-multi-line shape would
// silently corrupt every fit decision touching a multi-line verbatim
// slice (long callees, template literals, JSX text).
//
//  1. Build a Group whose first Text payload contains a newline and
//     whose second Text payload is short.
//  2. Print under a wide printWidth=80 — flat form would otherwise
//     fit comfortably.
//  3. Assert the surrounding group broke (Line emits a newline + indent),
//     proving fits() refused to accept the multi-line Text as flat.
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
