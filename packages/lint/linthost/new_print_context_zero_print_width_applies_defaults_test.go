package linthost

import "testing"

// TestNewPrintContextZeroPrintWidthAppliesDefaults verifies that
// NewPrintContext substitutes DefaultPrintOptions when the supplied
// opts carry a zero PrintWidth.
//
// Zero PrintWidth replaces every option, including otherwise nondefault
// indentation, line ending, comma policy and source geometry. Nonzero width
// preserves the supplied record. Literal expected records and original
// source text distinguish whole-set replacement from partial defaulting.
//
// @evidence contracts/testing.md#behavioral-verification NewPrintContext must select the complete default option set for zero width, preserve all supplied options for nonzero width, and retain file identity and text.
// @evidence contracts/testing.md#independent-expectations Literal eighty/two/LF/all defaults follow the documented constructor contract; an independently authored nonzero options record supplies the opposite expected result.
// @evidence contracts/testing.md#distinguishing-cases Zero width with otherwise nondefault values distinguishes whole-set replacement from partial defaulting; nonzero width and exact source association cover preservation.
// @evidence contracts/testing.md#execution-ownership TestNewPrintContextZeroPrintWidthAppliesDefaults is one Go unit entry that parses a trivial source and calls NewPrintContext with a zero-width and a nonzero-width option record in-process; it installs, builds and launches nothing.
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
