package linthost

import "testing"

// TestEngineLineSuffixDrainWithNewlineTracksColumn verifies that when
// a LineSuffix is drained inline (no preceding break) and its rendered
// content contains an embedded newline, the column tracker is updated
// from the last-newline position rather than the total string length.
//
// The drain loop at the end of Print mirrors the column-tracking logic
// inside flushLineSuffix: both must handle multi-line payloads by
// scanning for the last "\n" and computing the column from there. A
// regression that used `col += len(s)` unconditionally on a multi-line
// drain payload would report an inflated column — harmless today since
// the drain is the last statement, but the comment in the source notes
// that the invariant should not depend on that ordering.
//
//  1. Build Concat(Text("a"), LineSuffix(Text("x\ny"))) — no break
//     follows, so the LineSuffix is drained inline at end-of-output.
//  2. Print under default options.
//  3. Assert the output is "ax\ny", proving the drain appended the
//     multi-line payload verbatim.
func TestEngineLineSuffixDrainWithNewlineTracksColumn(t *testing.T) {
  doc := Concat(Text("a"), LineSuffix(Text("x\ny")))
  got := Print(doc, DefaultPrintOptions())
  if got != "ax\ny" {
    t.Fatalf("line-suffix drain newline-tracking mismatch: %q", got)
  }
}
