package linthost

import "testing"

// TestDisplayWidthAfterLastNewlineMeasuresTail verifies the column-reset helper
// measures only the text after the final newline, with the same rules.
//
// @evidence contracts/testing.md#behavioral-verification displayWidthAfterLastNewline must measure only the final tail, retaining full measurement when there is no break.
// @evidence contracts/testing.md#independent-expectations Literal widths follow the Prettier-measured character widths (star is two columns, ASCII one) and the ECMAScript line terminators LF, CRLF, CR, U+2028 and U+2029, with the tail starting after the last one.
// @evidence contracts/testing.md#distinguishing-cases Eight named subcases distinguish no break, nonempty LF tail, empty LF tail, and CRLF, bare CR, U+2028, U+2029 and last-of-two-breaks tails. The main width corpus owns character classification.
// @evidence contracts/testing.md#execution-ownership TestDisplayWidthAfterLastNewlineMeasuresTail is a top-level Go unit selected by the Go tests Evidence claim. Its eight named t.Run cases call displayWidthAfterLastNewline directly in-process; it installs no consumer, builds no native artifact and starts no formatter child or product host.
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
    {"cr-tail", "aaaa\r⭐", 2},
    {"line-separator-tail", "aaaa ab", 2},
    {"paragraph-separator-tail", "aaaa ⭐⭐", 4},
    {"last-of-two-breaks", "aaaa\nbbbbbb\ncc", 2},
  } {
    t.Run(tc.name, func(t *testing.T) {
      if got := displayWidthAfterLastNewline(tc.input); got != tc.want {
        t.Fatalf("displayWidthAfterLastNewline(%q) = %d, want %d", tc.input, got, tc.want)
      }
    })
  }
}
