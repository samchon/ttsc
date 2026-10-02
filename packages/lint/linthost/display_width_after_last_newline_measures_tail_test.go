package linthost

import "testing"

// TestDisplayWidthAfterLastNewlineMeasuresTail verifies the column-reset helper
// measures only the text after the final newline, with the same rules.
//
// @evidence contracts/testing.md#behavioral-verification displayWidthAfterLastNewline must measure only the final tail, retaining full measurement when there is no break.
// @evidence contracts/testing.md#independent-expectations Literal widths two, four, zero and two independently follow the frozen character widths and the final LF/CRLF boundary.
// @evidence contracts/testing.md#distinguishing-cases Four named subcases distinguish no break, nonempty LF tail, empty LF tail and CRLF tail. The main width corpus owns character classification.
// @evidence contracts/testing.md#execution-ownership TestDisplayWidthAfterLastNewlineMeasuresTail is a public format unit selected by the lint semantic-unit Evidence claim. It directly calls the width operation in the shared Go process; named t.Run rows remain individually identified, and the main corpus calls its private table-precondition helper. No formatter child or consumer artifact is executed.
func TestDisplayWidthAfterLastNewlineMeasuresTail(t *testing.T) {
  for _, tc := range []struct {
    name  string
    input string
    want  int
  }{
    {"no-newline", "⭐", 2},
    {"tail-after-newline", "aaaa\n⭐⭐", 4},
    {"empty-tail", "aaaa\n", 0},
    {"crlf-tail", "aaaa\r\nab", 2},
  } {
    t.Run(tc.name, func(t *testing.T) {
      if got := displayWidthAfterLastNewline(tc.input); got != tc.want {
        t.Fatalf("displayWidthAfterLastNewline(%q) = %d, want %d", tc.input, got, tc.want)
      }
    })
  }
}
