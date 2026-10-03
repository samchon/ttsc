package linthost

import "testing"

// TestIndentUnitUsesTabWidthWhenPositive verifies that indentUnit returns
// PrintOptions.TabWidth when the value is positive, and falls back to 2
// when TabWidth is zero.
//
// DefaultPrintOptions supplies a positive TabWidth, so that configuration
// takes the supplied-width branch. This case separately supplies zero
// TabWidth while retaining a nonzero PrintWidth, which prevents
// NewPrintContext from replacing the whole options value with defaults.
// The fallback arm (`return 2`) is reached when a context carries
// TabWidth == 0, which happens when a caller
// passes a partially-filled PrintOptions with PrintWidth set but TabWidth
// left at its zero value. Both branches are exercised here to confirm the
// guard handles that case correctly.
//
//  1. Parse any valid TypeScript source so a SourceFile is available.
//  2. Build a PrintContext with TabWidth = 4 and assert indentUnit returns 4.
//  3. Build a PrintContext with TabWidth = 0 (PrintWidth = 80) and assert
//     indentUnit falls back to 2.
//
// @evidence contracts/testing.md#behavioral-verification PrintContext.indentUnit must retain an explicit four-column width and default an omitted width to two.
// @evidence contracts/testing.md#independent-expectations The literal four and documented two-column default are layout-policy expectations, not values obtained from indentUnit.
// @evidence contracts/testing.md#distinguishing-cases Positive TabWidth four and omitted TabWidth zero distinguish supplied policy from defaulting.
// @evidence contracts/testing.md#execution-ownership TestIndentUnitUsesTabWidthWhenPositive is one Go unit entry that parses a trivial source for two PrintContexts and calls the unexported indentUnit on each in-process; it installs, builds and launches nothing.
func TestIndentUnitUsesTabWidthWhenPositive(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")

  // TabWidth > 0: returns the configured value.
  opts := DefaultPrintOptions()
  opts.TabWidth = 4
  ctx := NewPrintContext(file, opts)
  got := ctx.indentUnit()
  if got != 4 {
    t.Fatalf("want indentUnit=4 for TabWidth=4, got %d", got)
  }

  // TabWidth == 0 with a non-zero PrintWidth: NewPrintContext keeps opts
  // as-is (the PrintWidth guard does not fire), so TabWidth stays 0 and
  // indentUnit falls back to 2.
  zeroOpts := PrintOptions{PrintWidth: 80, TabWidth: 0}
  ctxZero := NewPrintContext(file, zeroOpts)
  gotZero := ctxZero.indentUnit()
  if gotZero != 2 {
    t.Fatalf("want indentUnit=2 for TabWidth=0, got %d", gotZero)
  }
}
