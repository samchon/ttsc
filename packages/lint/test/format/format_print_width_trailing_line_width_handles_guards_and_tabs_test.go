package linthost

import "testing"

// TestFormatPrintWidthTrailingLineWidthHandlesGuardsAndTabs verifies
// trailingLineWidth across its guard and tab-handling branches.
//
// The suffix budget must reject invalid offsets, trim trailing blank bytes and
// expand tabs to actual stops. Direct calls distinguish those measurements
// from formatter layout choices and include supported source line endings.
//
// 1. Retain invalid-offset, default-tab and trimmed-punctuation assertions.
// 2. Check empty/exact-end suffixes and negative/explicit tab widths.
// 3. Assert CR, CRLF, U+2028 and U+2029 terminate the measured suffix.
//
// @evidence contracts/testing.md#behavioral-verification trailingLineWidth must preserve original invalid-range/default-tab/trim results, handle empty/exact-end suffixes and measure four-column stops while ending at every supported line separator.
// @evidence contracts/testing.md#independent-expectations Literal positions and manually counted tab stops independently fix suffix widths. Empty and invalid ranges have no suffix; CR/CRLF/LS/PS terminators separate the next-line payload from the measured x.
// @evidence contracts/testing.md#distinguishing-cases Negative/past/end offsets, empty input, zero/negative tab widths, explicit mixed-space/tab stops, trimmed punctuation and four line-ending fixtures expose each meaningful boundary.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthTrailingLineWidthHandlesGuardsAndTabs owns the original direct assertions and all added suffix/line-separator cases in the selected public Go unit population. Direct trailingLineWidth calls for the original and added cases execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatPrintWidthTrailingLineWidthHandlesGuardsAndTabs(t *testing.T) {
  if got := trailingLineWidth("abc", -1, 2); got != 0 {
    t.Fatalf("negative end: want 0, got %d", got)
  }
  if got := trailingLineWidth("abc", 99, 2); got != 0 {
    t.Fatalf("end past length: want 0, got %d", got)
  }
  // tabWidth<=0 falls back to 2; the leading tab then expands to a
  // two-column stop and the trailing `x` adds one.
  if got := trailingLineWidth("\tx", 0, 0); got != 3 {
    t.Fatalf("tab suffix with default tabWidth: want 3, got %d", got)
  }
  // Trailing whitespace after `);` is trimmed before the width is
  // measured, so only the two non-space columns count.
  if got := trailingLineWidth(");   \n", 0, 2); got != 2 {
    t.Fatalf("trailing whitespace trimmed: want 2, got %d", got)
  }
  if trailingLineWidth("", 0, 2) != 0 || trailingLineWidth("abc", 3, 2) != 0 {
    t.Fatal("empty and exact-end suffixes have zero columns")
  }
  if got := trailingLineWidth("\tx", 0, -1); got != 3 {
    t.Fatalf("negative width uses default stops: want 3, got %d", got)
  }
  if got := trailingLineWidth(" \tx", 0, 4); got != 5 {
    t.Fatalf("space then tab reaches four-column stop: want 5, got %d", got)
  }
  for _, source := range []string{"x\rnext", "x\r\nnext", "x\u2028next", "x\u2029next"} {
    if got := trailingLineWidth(source, 0, 2); got != 1 {
      t.Fatalf("line separator ends suffix in %q: want 1, got %d", source, got)
    }
  }
}
