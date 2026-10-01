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
//  3. Check named empty, prefix/suffix, line-separator and explicit-tab-stop rows.
//
// @evidence contracts/testing.md#behavioral-verification maxLineWidth must retain the original zero-tab-width result, charge prefix/suffix on their proper lines and return the widest effective line across supported terminators and actual tab stops.
// @evidence contracts/testing.md#independent-expectations Literal text, fixed prefix/suffix columns and independently counted tab-stop positions determine expected zero/four/six/eight/nine values. Named cases specify measurements without reusing the implementation scan.
// @evidence contracts/testing.md#distinguishing-cases Empty, one/two lines, LF/CRLF/LS/PS, zero/negative width, explicit four-column tabs and a space-before-tab distinguish guards, line charging and tab-stop behavior.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthMaxLineWidthUsesTwoWhenTabWidthNonpositive owns the original assertion and every named measurement row through direct maxLineWidth calls in the selected public Go unit population. Direct maxLineWidth calls for every named row execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatPrintWidthMaxLineWidthUsesTwoWhenTabWidthNonpositive(t *testing.T) {
  if got := maxLineWidth("\tab", 0, 0, 0); got != 4 {
    t.Fatalf("tab with default tabWidth: want 4, got %d", got)
  }
  cases := []struct {
    name string
    text string
    prefix, suffix, tabWidth, want int
  }{
    {"empty", "", 0, 0, 2, 0},
    {"one-line-charges-both", "ab", 3, 4, 2, 9},
    {"lf-first-and-last", "abc\nx", 2, 7, 2, 8},
    {"crlf-first-and-last", "abc\r\nx", 2, 7, 2, 8},
    {"line-separator", "abc\u2028x", 2, 7, 2, 8},
    {"paragraph-separator", "abc\u2029x", 2, 7, 2, 8},
    {"negative-width-default", "\tab", 0, 0, -1, 4},
    {"four-column-tab", "\tab", 0, 0, 4, 6},
    {"space-then-tab", " \tab", 0, 0, 4, 6},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      if got := maxLineWidth(tc.text, tc.prefix, tc.suffix, tc.tabWidth); got != tc.want {
        t.Fatalf("effective widest line: want %d, got %d", tc.want, got)
      }
    })
  }
}
