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
//
// @evidence contracts/testing.md#behavioral-verification sliceContainsNewline must clamp out-of-bounds ranges while detecting supported line separators only within the half-open slice.
// @evidence contracts/testing.md#independent-expectations Literal LF at byte five and CR/U+2028/U+2029 fixtures supply lexical newline expectations independently; range endpoints five and six distinguish exclusion and inclusion.
// @evidence contracts/testing.md#distinguishing-cases Negative start, excessive end, flat text, empty/reversed spans, adjacent LF endpoint and three other supported separators expose safety and actual classification.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthSliceContainsNewlineClampOutOfRangeBounds is a selected public Go unit under the lint semantic-unit Evidence claim. This entry owns every local assertion and table row, invoking the column or source predicate in the shared process without consumer installation, a native product build or host execution.
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
  if sliceContainsNewline(src, 5, 5) || sliceContainsNewline(src, 6, 5) {
    t.Fatal("empty and reversed ranges contain no newline")
  }
  if sliceContainsNewline(src, 0, 5) || !sliceContainsNewline(src, 0, 6) {
    t.Fatal("half-open range must exclude then include the adjacent LF")
  }
  for _, source := range []string{"a\rb", "a\u2028b", "a\u2029b"} {
    if !sliceContainsNewline(source, 0, len(source)) {
      t.Fatalf("supported line separator must be detected in %q", source)
    }
  }
}
