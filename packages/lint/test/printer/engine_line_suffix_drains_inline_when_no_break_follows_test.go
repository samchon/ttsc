package linthost

import "testing"

// TestEngineLineSuffixDrainsInlineWhenNoBreakFollows verifies that a
// LineSuffix whose queued content never meets a line-break is flushed
// inline at the very end of the output, not discarded.
//
// The trailing-drain loop exists because some printers emit a
// LineSuffix at the end of a node that happens to be the last thing
// on the page — there is no subsequent Hardline to trigger the normal
// flush. Rather than silently dropping the queued comment, the engine
// appends it after the main loop. This test pins that drain so a
// refactor that removed the trailing loop would not silently eat the
// content.
//
//  1. Build Concat(Text("a"), LineSuffix(Text(" // end"))) — no
//     Hardline or Softline follows the LineSuffix.
//  2. Print under default options.
//  3. Assert the output is "a // end", confirming the drain path ran
//     and the suffix was appended inline.
func TestEngineLineSuffixDrainsInlineWhenNoBreakFollows(t *testing.T) {
  doc := Concat(Text("a"), LineSuffix(Text(" // end")))
  got := Print(doc, DefaultPrintOptions())
  if got != "a // end" {
    t.Fatalf("line-suffix no-break drain mismatch: %q", got)
  }
}
