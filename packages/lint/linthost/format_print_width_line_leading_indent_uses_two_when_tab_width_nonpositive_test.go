package linthost

import "testing"

// TestFormatPrintWidthLineLeadingIndentUsesTwoWhenTabWidthNonpositive verifies
// lineLeadingIndent falls back to tabWidth=2 when the caller passes 0 or a
// negative value.
//
// Locks the fallback `if tabWidth <= 0 { tabWidth = 2 }` branch inside
// lineLeadingIndent. The fallback mirrors the Prettier default so a zero-valued
// PrintOptions.TabWidth does not silently produce incorrect indent measurements.
//
//  1. Build a source line indented with two tabs.
//  2. Call lineLeadingIndent with tabWidth=0 (should use 2 as fallback).
//  3. Assert the returned column equals 4 (two tabs × 2 columns each).
//  4. Call lineLeadingIndent with tabWidth=-1 (also triggers the fallback).
//  5. Assert the returned column equals 4.
//
// @evidence contracts/testing.md#behavioral-verification lineLeadingIndent must default nonpositive tab widths, honor explicit tab stops and count indentation rather than all text before the node.
// @evidence contracts/testing.md#independent-expectations Two literal tabs imply four columns under the documented default or eight under explicit width four; one space then tab lands at the next stop, and two initial spaces remain the indent after text starts.
// @evidence contracts/testing.md#distinguishing-cases Zero/negative widths contrast with explicit width four, mixed spaces/tabs, a position inside content and the file-start empty indent.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthLineLeadingIndentUsesTwoWhenTabWidthNonpositive is a selected public Go unit under TestSelectedLintUnits. This entry owns every local assertion and table row, invoking the column or source predicate in the shared process without consumer installation, a native product build or host execution.
func TestFormatPrintWidthLineLeadingIndentUsesTwoWhenTabWidthNonpositive(t *testing.T) {
  // "\t\tconst x = 1;\n" — two leading tabs, then the statement.
  src := "\t\tconst x = 1;\n"
  // pos points at 'c' in "const" (after the two tabs at positions 0 and 1).
  pos := 2

  if got := lineLeadingIndent(src, pos, 0); got != 4 {
    t.Fatalf("lineLeadingIndent(tabWidth=0): want 4, got %d", got)
  }
  if got := lineLeadingIndent(src, pos, -1); got != 4 {
    t.Fatalf("lineLeadingIndent(tabWidth=-1): want 4, got %d", got)
  }
  if got := lineLeadingIndent(src, pos, 4); got != 8 {
    t.Fatalf("explicit four-column stops must give eight, got %d", got)
  }
  if got := lineLeadingIndent(" \tvalue", 2, 4); got != 4 {
    t.Fatalf("mixed indentation must reach the next stop, got %d", got)
  }
  if got := lineLeadingIndent("  value + other", 10, 2); got != 2 {
    t.Fatalf("indent excludes nonblank text before the node, got %d", got)
  }
  if got := lineLeadingIndent("value", 0, 2); got != 0 {
    t.Fatalf("file-start indentation is zero, got %d", got)
  }
}
