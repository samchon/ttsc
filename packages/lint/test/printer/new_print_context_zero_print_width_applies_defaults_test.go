package linthost

import "testing"

// TestNewPrintContextZeroPrintWidthAppliesDefaults verifies that
// NewPrintContext substitutes DefaultPrintOptions when the supplied
// opts carry a zero PrintWidth.
//
// The zero-width guard exists so call sites can pass a partially-filled
// PrintOptions (or the zero value) without producing an unusable context.
// Without the branch, a PrintWidth of 0 would reach the engine where
// `opts.PrintWidth <= 0` is normalised in Print — but the context's Opts
// field would still hold 0, which breaks callers that read Opts.PrintWidth
// directly (e.g. formatPrintWidth). The branch pins that the guard
// triggers at construction time, not at render time.
//
//  1. Parse any valid TypeScript source so a SourceFile is available.
//  2. Call NewPrintContext with opts whose PrintWidth is 0 (zero value).
//  3. Assert the returned context carries the Prettier-default PrintWidth (80).
func TestNewPrintContextZeroPrintWidthAppliesDefaults(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, PrintOptions{}) // PrintWidth == 0
  if ctx.Opts.PrintWidth != 80 {
    t.Fatalf("want PrintWidth=80 after zero-width default, got %d", ctx.Opts.PrintWidth)
  }
}
