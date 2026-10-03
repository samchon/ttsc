package linthost

import "testing"

// TestEngineFitsTreatsIndentAlignAsTransparentInFlat verifies the
// `fits()` measurement walks through `Indent` and `Align` wrappers
// transparently when their group is in flat mode.
//
// Flat foo bar has seven columns regardless of its Indent four or Align
// wrapper. A third case precedes Align with three emitted columns and gives
// its parent indentation four: prefoo bar exactly fills width ten, so charging
// either alignment or parent indentation against flat width would break it.
//
// @evidence contracts/testing.md#behavioral-verification Print must render Indent-four and zero-column Align groups as foo bar, and a nonzero-column Align group as prefoo bar exactly within width ten despite parent BaseIndent four.
// @evidence contracts/testing.md#independent-expectations Authored foo bar has seven columns and pre adds three, exactly ten. Flat indentation contributes no bytes; expected literals are independent of the measurement implementation.
// @evidence contracts/testing.md#distinguishing-cases One Indent and two Align controls include nonzero emitted column and parent indentation, distinguishing transparent flat measurement from erroneous column charging; broken placement has sibling cases.
// @evidence contracts/testing.md#execution-ownership TestEngineFitsTreatsIndentAlignAsTransparentInFlat is one Go unit entry that renders three authored Indent/Align Doc trees with Print at width 10, including an emitted prefix and BaseIndent four, in-process; it parses no source and installs, builds and launches nothing.
func TestEngineFitsTreatsIndentAlignAsTransparentInFlat(t *testing.T) {
  opts := DefaultPrintOptions()
  opts.PrintWidth = 10
  indented := Group(Indent(4, Text("foo"), Line(), Text("bar")))
  if got := Print(indented, opts); got != "foo bar" {
    t.Fatalf("flat indent transparency mismatch: %q", got)
  }
  aligned := Group(Align(Text("foo"), Line(), Text("bar")))
  if got := Print(aligned, opts); got != "foo bar" {
    t.Fatalf("flat align transparency mismatch: %q", got)
  }
  opts.BaseIndent = 4
  aligned = Concat(Text("pre"), Group(Align(Text("foo"), Line(), Text("bar"))))
  if got := Print(aligned, opts); got != "prefoo bar" {
    t.Fatalf("flat Align must not charge current column or parent indentation: got %q", got)
  }
}
