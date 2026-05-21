package linthost

import "testing"

// TestEngineLineSuffixWithEmbeddedNewlineTracksColumn verifies that
// when the content rendered during a LineSuffix flush contains an
// embedded newline, the column tracker is reset to the width of the
// text after that newline rather than accumulating the full string
// length.
//
// LineSuffix payloads are "leaf-ish by contract" (trailing comments),
// but the engine must handle the edge case where the payload itself
// spans lines — for instance a diagnostics-style annotation that
// includes a multi-line message. If the column tracker ignored the
// embedded newline it would report an inflated column, causing the
// next fit-or-break decision on the same output line to use a
// phantom starting column and either break prematurely or exceed the
// print width.
//
//  1. Build Concat(Text("a"), LineSuffix(Text("x\ny")),
//     Hardline(), Text("b")).
//  2. The Hardline triggers flushLineSuffix; the LineSuffix payload
//     "x\ny" contains a newline.
//  3. Print under default options and assert the full output is
//     "ax\ny\nb" — the flush writes "x\ny" before the Hardline's
//     newline, and "b" follows on its own line.
func TestEngineLineSuffixWithEmbeddedNewlineTracksColumn(t *testing.T) {
  doc := Concat(
    Text("a"),
    LineSuffix(Text("x\ny")),
    Hardline(),
    Text("b"),
  )
  got := Print(doc, DefaultPrintOptions())
  if got != "ax\ny\nb" {
    t.Fatalf("line-suffix embedded-newline mismatch: %q", got)
  }
}
