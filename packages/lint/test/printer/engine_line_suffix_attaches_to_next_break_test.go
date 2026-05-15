package main

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
