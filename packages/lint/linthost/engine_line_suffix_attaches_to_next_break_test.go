package linthost

import "testing"

// TestEngineLineSuffixAttachesToNextBreak verifies LineSuffix output is
// deferred until the next newline-emitting doc actually fires.
//
// LineSuffix is how a per-node printer attaches a trailing
// `// comment` to its source line: the comment must appear *after*
// the comma or expression on the same line but *before* the engine
// inserts the newline. The fixture sandwiches a LineSuffix between a
// Text and a Hardline, then verifies the queued content lands before
// the break.
//
//  1. Build Concat(Text("a"), LineSuffix(Text(" // c")), Hardline(),
//     Text("b")).
//  2. Print under default options.
//  3. Assert the comment appears immediately before the newline.
//
// @evidence contracts/testing.md#behavioral-verification Print must emit the queued comment after a and before the newline leading to b.
// @evidence contracts/testing.md#independent-expectations The LineSuffix contract orders the literal a // c\nb without moving or dropping comment bytes.
// @evidence contracts/testing.md#distinguishing-cases A following Hardline flushes the suffix; the no-following-break case covers final draining.
// @evidence contracts/testing.md#execution-ownership TestEngineLineSuffixAttachesToNextBreak is one Go unit entry that renders a literal Concat holding a LineSuffix before a Hardline with Print in-process; it parses no source and installs, builds and launches nothing.
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
}
