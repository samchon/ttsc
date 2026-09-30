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
//
// @evidence contracts/testing.md#behavioral-verification NewPrintContext must select the complete default option set for zero width, preserve all supplied options for nonzero width, and retain file identity and text.
// @evidence contracts/testing.md#independent-expectations Literal eighty/two/LF/all defaults follow the documented constructor contract; an independently authored nonzero options record supplies the opposite expected result.
// @evidence contracts/testing.md#distinguishing-cases Zero width with otherwise nondefault values distinguishes whole-set replacement from partial defaulting; nonzero width and exact source association cover preservation.
// @evidence contracts/testing.md#execution-ownership TestNewPrintContextZeroPrintWidthAppliesDefaults is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
func TestNewPrintContextZeroPrintWidthAppliesDefaults(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, PrintOptions{TabWidth: 8, UseTabs: true, EndOfLine: "crlf", TrailingComma: "none", StartingColumn: 5, BaseIndent: 4})
  if ctx.Opts.PrintWidth != 80 {
    t.Fatalf("want PrintWidth=80 after zero-width default, got %d", ctx.Opts.PrintWidth)
  }
  want := PrintOptions{PrintWidth: 80, TabWidth: 2, EndOfLine: "lf", TrailingComma: "all"}
  if ctx.Opts != want {
    t.Fatalf("zero width selects the complete default option set: got %+v, want %+v", ctx.Opts, want)
  }
  supplied := PrintOptions{PrintWidth: 90, TabWidth: 4, UseTabs: true, EndOfLine: "crlf", TrailingComma: "none", StartingColumn: 5, BaseIndent: 4}
  explicit := NewPrintContext(file, supplied)
  if explicit.Opts != supplied {
    t.Fatalf("nonzero width must preserve every supplied option: got %+v", explicit.Opts)
  }
  if explicit.File != file || explicit.Source != "const x = 1;\n" {
    t.Fatal("context must retain the provided source-file identity and text")
  }
}
