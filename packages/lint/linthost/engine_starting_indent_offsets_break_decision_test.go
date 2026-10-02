package linthost

import "testing"

// TestEngineStartingIndentOffsetsBreakDecision verifies the
// StartingColumn option charges its column count against the printWidth
// budget while BaseIndent controls where continuation lines align.
//
// The authored seven-column foo bar group has only five columns left when
// StartingColumn is five and PrintWidth is ten. Its first fragment receives
// no generated indentation; BaseIndent two independently supplies the two
// spaces on the broken continuation. This direct case uses no AST reflow.
//
// @evidence contracts/testing.md#behavioral-verification Print must break foo bar and align bar to BaseIndent two when StartingColumn five consumes the width-ten budget.
// @evidence contracts/testing.md#independent-expectations Seven flat columns exceed the five remaining; the literal two-space continuation follows BaseIndent independently.
// @evidence contracts/testing.md#distinguishing-cases Nonzero starting geometry distinguishes this from the same doc fitting at column zero.
// @evidence contracts/testing.md#execution-ownership TestEngineStartingIndentOffsetsBreakDecision is one Go unit entry that renders a literal Group with Print under StartingColumn 5, BaseIndent 2 and PrintWidth 10 in-process; it parses no source and installs, builds and launches nothing.
func TestEngineStartingIndentOffsetsBreakDecision(t *testing.T) {
  doc := Group(Text("foo"), Line(), Text("bar"))
  opts := DefaultPrintOptions()
  opts.PrintWidth = 10
  opts.StartingColumn = 5
  opts.BaseIndent = 2
  got := Print(doc, opts)
  want := "foo\n  bar"
  if got != want {
    t.Fatalf("starting indent mismatch:\nwant %q\ngot  %q", want, got)
  }
}
