package linthost

import "testing"

// TestFormatPrintWidthSliceContainsNewlineClampOutOfRangeBounds verifies that
// sliceContainsNewline handles out-of-range start and end parameters safely by
// clamping them to valid positions rather than panicking.
//
// Locks the two clamping guards inside sliceContainsNewline:
//   - `if start < 0 { start = 0 }` prevents a negative loop lower bound.
//   - `if end > len(src) { end = len(src) }` prevents a slice-bounds panic.
//
// The guards matter because callers in Check derive start/end from SkipTrivia
// which is guaranteed non-negative for valid sources, but defensive clamping
// keeps the helper safe for future callers that may pass unchecked values.
//
//  1. Call sliceContainsNewline with start=-5 on a source that contains a newline.
//     The clamped start=0 must include the newline, so the result is true.
//  2. Call sliceContainsNewline with end=9999 (beyond len(src)).
//     The clamped end=len(src) must still find the newline, so the result is true.
//  3. Call sliceContainsNewline with start=-5 on a single-line source.
//     No newline exists in the valid range, so the result is false.
func TestFormatPrintWidthSliceContainsNewlineClampOutOfRangeBounds(t *testing.T) {
  src := "hello\nworld"

  // Negative start: clamped to 0, newline at offset 5 is within [0, len(src)).
  if got := sliceContainsNewline(src, -5, len(src)); !got {
    t.Fatalf("sliceContainsNewline(src, -5, len): want true (clamped start=0 covers \\n), got false")
  }

  // End beyond bounds: clamped to len(src), newline still found.
  if got := sliceContainsNewline(src, 0, 9999); !got {
    t.Fatalf("sliceContainsNewline(src, 0, 9999): want true (clamped end=len covers \\n), got false")
  }

  // Negative start on a no-newline source: clamped start=0, no newline in [0, end).
  srcFlat := "hello world"
  if got := sliceContainsNewline(srcFlat, -3, len(srcFlat)); got {
    t.Fatalf("sliceContainsNewline(flat, -3, len): want false, got true")
  }
}
