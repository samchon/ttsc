package linthost

import "testing"

// TestFormatPrintWidthTrailingLineWidthHandlesGuardsAndTabs verifies
// trailingLineWidth across its guard and tab-handling branches.
//
// trailingLineWidth feeds the un-movable suffix width into the
// print-width budget. Its edge branches — an out-of-range `end`, a
// non-positive tabWidth, trailing whitespace that must be trimmed, and a
// tab inside the suffix — never arise from the rule's own call site, so
// they need a direct exercise to stay covered.
//
//  1. Call trailingLineWidth with an out-of-range end (negative and past
//     the source length).
//  2. Call it with a non-positive tabWidth and a tab in the suffix.
//  3. Call it with a suffix carrying trailing whitespace to trim.
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
}
