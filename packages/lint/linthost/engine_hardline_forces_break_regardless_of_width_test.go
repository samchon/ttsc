package linthost

import "testing"

// TestEngineHardlineForcesBreakRegardlessOfWidth verifies a Hardline
// inside a Group always emits a newline, even when the surrounding
// budget would happily fit the flat form.
//
// The two literal fragments are short enough for the default width, but an
// authored Hardline still requires one LF between them. This direct Group
// case distinguishes the mandatory break from an ordinary fitting Line.
//
// @evidence contracts/testing.md#behavioral-verification Print must retain a newline between foo and bar inside a generously sized Group.
// @evidence contracts/testing.md#independent-expectations Hardline is unconditional in the Doc algebra, giving the literal foo\nbar.
// @evidence contracts/testing.md#distinguishing-cases An ample budget distinguishes Hardline from the ordinary Line fit case.
// @evidence contracts/testing.md#execution-ownership TestEngineHardlineForcesBreakRegardlessOfWidth is one Go unit entry that renders a Hardline-bearing literal Group with Print under default options in-process; it parses no source and installs, builds and launches nothing.
func TestEngineHardlineForcesBreakRegardlessOfWidth(t *testing.T) {
  doc := Group(Text("foo"), Hardline(), Text("bar"))
  got := Print(doc, DefaultPrintOptions())
  if got != "foo\nbar" {
    t.Fatalf("hardline mismatch: %q", got)
  }
}
