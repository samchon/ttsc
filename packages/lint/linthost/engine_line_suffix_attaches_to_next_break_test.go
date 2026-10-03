package linthost

import "testing"

// TestEngineLineSuffixAttachesToNextBreak verifies LineSuffix output is
// deferred until the next newline-emitting doc actually fires.
//
// A following Hardline flushes the queued comment before the next line.
// A second fixture puts literal comma text after the suffix: that text must
// appear before the queued comment, distinguishing deferred from immediate
// suffix output. No AST comment producer is dispatched in this direct case.
//
// @evidence contracts/testing.md#behavioral-verification Print must emit the comment before the triggering newline, after all remaining same-line text including a comma supplied after the suffix.
// @evidence contracts/testing.md#independent-expectations Authored a // c and a, // c followed by LF and b follow deferred suffix ordering; expected strings are literal, not renderer-produced.
// @evidence contracts/testing.md#distinguishing-cases Remaining comma text after queueing distinguishes deferred output from immediate rendering; a following Hardline contrasts with final draining without a break.
// @evidence contracts/testing.md#execution-ownership TestEngineLineSuffixAttachesToNextBreak is one Go unit entry that renders two authored Concats holding a LineSuffix before a Hardline, one with subsequent same-line comma text, with Print in-process; it parses no source and installs, builds and launches nothing.
func TestEngineLineSuffixAttachesToNextBreak(t *testing.T) {
  doc := Concat(
    Text("a"),
    LineSuffix(Text(" // c")),
    Hardline(),
    Text("b"),
  )
  got := Print(doc, DefaultPrintOptions())
  if got != "a // c\nb" {
    t.Fatalf("line suffix mismatch: %q", got)
  }
  doc = Concat(Text("a"), LineSuffix(Text(" // c")), Text(","), Hardline(), Text("b"))
  got = Print(doc, DefaultPrintOptions())
  if got != "a, // c\nb" {
    t.Fatalf("same-line text must precede the deferred suffix: got %q", got)
  }
}
