package linthost

import "testing"

// TestFormatPrintWidthLeadingColumnReturnsZeroWhenPosIsNonpositive verifies
// leadingColumn returns 0 immediately when pos is 0 or negative, and falls back
// to tabWidth=2 when a non-positive tabWidth is supplied.
//
// Locks two guards inside leadingColumn:
//
//   - `if pos <= 0 { return 0 }` — prevents out-of-range indexing and
//     gives the caller the correct column (0) for file-start positions.
//
//   - `if tabWidth <= 0 { tabWidth = 2 }` — mirrors the Prettier default
//     so a zero-valued PrintOptions.TabWidth never corrupts column counts.
//
//     1. Call leadingColumn with pos=0 — expects 0 (early return).
//     2. Call leadingColumn with pos=-1 — expects 0 (early return).
//     3. Call leadingColumn with a positive pos and tabWidth=0 — expects the
//     column computed using the default tabWidth of 2.
//
// @evidence contracts/testing.md#behavioral-verification leadingColumn must return file-start column zero, default nonpositive tab widths to two and measure the current line using actual tab stops.
// @evidence contracts/testing.md#independent-expectations Literal byte offsets identify two tabs, one space followed by a tab, and two spaces after LF; their expected visual columns follow tab-stop and line-origin contracts.
// @evidence contracts/testing.md#distinguishing-cases Zero/negative position, zero/negative tab width, explicit four-column stops and a second-line origin distinguish early guards from valid nonzero results.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthLeadingColumnReturnsZeroWhenPosIsNonpositive is selected as a public Go unit by the lint semantic-unit Evidence claim; its local cases call the owning operation in the shared process without a consumer install, native artifact build or product host.
func TestFormatPrintWidthLeadingColumnReturnsZeroWhenPosIsNonpositive(t *testing.T) {
  src := "const x = 1;\n"
  if got := leadingColumn(src, 0, 2); got != 0 {
    t.Fatalf("leadingColumn(src, 0, 2): want 0, got %d", got)
  }
  if got := leadingColumn(src, -1, 2); got != 0 {
    t.Fatalf("leadingColumn(src, -1, 2): want 0, got %d", got)
  }

  // tabWidth=0 must fall back to 2. The source "\t\tconst" has two leading
  // tabs; with the default tabWidth=2 each tab steps to the next 2-column
  // boundary, giving a starting column of 4 for pos=2.
  tabSrc := "\t\tconst x = 1;\n"
  if got := leadingColumn(tabSrc, 2, 0); got != 4 {
    t.Fatalf("leadingColumn(tabSrc, 2, 0): want 4 (tabWidth fallback=2), got %d", got)
  }
  if got := leadingColumn(tabSrc, 2, -1); got != 4 {
    t.Fatalf("negative tab width must default to two-column stops, got %d", got)
  }
  if got := leadingColumn(" \tvalue", 2, 4); got != 4 {
    t.Fatalf("a tab after one space must reach the next four-column stop, got %d", got)
  }
  if got := leadingColumn("prior\n  value", 8, 2); got != 2 {
    t.Fatalf("column starts after the last newline, got %d", got)
  }
}
