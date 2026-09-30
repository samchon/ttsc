package linthost

import "testing"

// TestEngineGroupBreaksWhenOverflowsWidth verifies a Group whose flat
// projection would overflow the column budget renders Lines as
// newline+indent and Softlines as newline+indent.
//
// This is the break branch — the entire premise of printWidth-style
// reflow. The fixture uses a deliberately tight budget (printWidth=4)
// so a two-fragment group is forced to break even though the flat
// rendering would only be 7 characters wide.
//
//  1. Build the same Group as the fit case (two Texts joined by Line).
//  2. Print under printWidth=4 to force a break.
//  3. Assert the result is `foo\nbar`, i.e. broken with zero indent.
//
// @evidence contracts/testing.md#behavioral-verification Print must separate foo and bar by a newline at width four.
// @evidence contracts/testing.md#independent-expectations The flat foo bar is seven columns, exceeding four; both payloads and their order remain unchanged.
// @evidence contracts/testing.md#distinguishing-cases This tight-width branch complements the wide-budget flat group case.
// @evidence contracts/testing.md#execution-ownership TestEngineGroupBreaksWhenOverflowsWidth is a public Go unit entry selected with printer cases by TestSelectedLintUnits. It calls the Doc operation in the same Go test process, without a consumer install, native build or product host.
func TestEngineGroupBreaksWhenOverflowsWidth(t *testing.T) {
  doc := Group(Text("foo"), Line(), Text("bar"))
  opts := DefaultPrintOptions()
  opts.PrintWidth = 4
  got := Print(doc, opts)
  if got != "foo\nbar" {
    t.Fatalf("broken group mismatch: %q", got)
  }
}
