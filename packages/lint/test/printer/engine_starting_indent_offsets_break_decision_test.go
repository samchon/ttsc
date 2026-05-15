package main

import "testing"

// TestEngineStartingIndentOffsetsBreakDecision verifies the
// StartingColumn option charges its column count against the printWidth
// budget while BaseIndent controls where continuation lines align.
//
// The rule wiring renders interior nodes (object literals nested in a
// `const foo = …` declaration) starting at a non-zero column. Without
// the option, fit measurement would lie about the available width and
// the broken continuation lines would dedent to column 0. The case
// pins both effects in one fixture by deliberately choosing a doc
// whose flat form would fit at column 0 but breaks once StartingColumn
// eats the prefix; BaseIndent then drives the continuation alignment.
//
//  1. Build Group("foo", Line(), "bar") whose flat width is 7.
//  2. Set printWidth=10, StartingColumn=5, BaseIndent=2.
//  3. Assert the group breaks and the continuation line aligns to
//     column 2.
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
