package linthost

import "testing"

// TestEngineLineSuffixDrainsInlineWhenNoBreakFollows verifies that a
// LineSuffix whose queued content never meets a line-break is flushed
// inline at the very end of the output, not discarded.
//
// A final queued comment survives without a following break. A second
// fixture puts comma text after queueing: final draining must keep that
// same-line text before the comment, rather than rendering the suffix early.
//
// @evidence contracts/testing.md#behavioral-verification Print must retain the final queued comment without a following break and place any subsequent same-line comma before it.
// @evidence contracts/testing.md#independent-expectations Independently authored a // end and a, // end encode retained comment bytes and final-drain ordering without computing expected output through Print.
// @evidence contracts/testing.md#distinguishing-cases Subsequent comma text distinguishes final deferral from immediate suffix rendering, while a sibling uses a Hardline-triggered flush.
// @evidence contracts/testing.md#execution-ownership TestEngineLineSuffixDrainsInlineWhenNoBreakFollows is one Go unit entry that renders two authored Concats with a LineSuffix and no following break, one with subsequent comma text, with Print in-process; it parses no source and installs, builds and launches nothing.
func TestEngineLineSuffixDrainsInlineWhenNoBreakFollows(t *testing.T) {
  doc := Concat(Text("a"), LineSuffix(Text(" // end")))
  got := Print(doc, DefaultPrintOptions())
  if got != "a // end" {
    t.Fatalf("line-suffix no-break drain mismatch: %q", got)
  }
  doc = Concat(Text("a"), LineSuffix(Text(" // end")), Text(","))
  got = Print(doc, DefaultPrintOptions())
  if got != "a, // end" {
    t.Fatalf("final drain must follow the remaining same-line text: got %q", got)
  }
}
