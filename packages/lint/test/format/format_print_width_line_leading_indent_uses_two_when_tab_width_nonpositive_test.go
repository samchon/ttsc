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
}
