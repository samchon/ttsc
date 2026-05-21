package linthost

import "testing"

// TestFormatPrintWidthMaxLineWidthUsesTwoWhenTabWidthNonpositive verifies
// maxLineWidth falls back to a tab width of two columns when the supplied
// tabWidth is non-positive.
//
// maxLineWidth is the rule's safety-floor measurement. Its caller always
// passes the resolved print options, so the `tabWidth <= 0` fallback is
// never reached from the rule itself and needs a direct exercise.
//
//  1. Call maxLineWidth with a leading tab and tabWidth = 0.
//  2. Assert the tab expanded to two columns (tab + "ab" = 4).
func TestFormatPrintWidthMaxLineWidthUsesTwoWhenTabWidthNonpositive(t *testing.T) {
  if got := maxLineWidth("\tab", 0, 0, 0); got != 4 {
    t.Fatalf("tab with default tabWidth: want 4, got %d", got)
  }
}
