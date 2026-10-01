package linthost

import "testing"

// TestEngineTabWidthDefaultsWhenZero verifies that Print substitutes
// the standard 2-column tab width when TabWidth is zero or negative.
//
// A TabWidth of 0 would cause division-by-zero inside writeIndent when
// UseTabs is true (tabs = indent / TabWidth). Substituting 2 matches
// Prettier's default and prevents a panic in the tab-indent path for
// callers that zero-initialise PrintOptions.
//
//  1. Build Indent(2, Hardline(), Text("x")) — one indent level.
//  2. Print with TabWidth=0 and UseTabs=true.
//  3. Assert the indented line is "\n\tx", confirming the engine
//     defaulted to TabWidth=2 and emitted one tab for the 2-column
//     indent rather than panicking.
//
// @evidence contracts/testing.md#behavioral-verification Print must emit one tab before x for both zero and negative TabWidth with UseTabs enabled.
// @evidence contracts/testing.md#independent-expectations The documented default of two columns divides Indent two into one tab, yielding the literal newline-tab-x.
// @evidence contracts/testing.md#distinguishing-cases Both nonpositive tab widths must select the two-column default; explicit-width and remainder-space cases cover positive widths.
// @evidence contracts/testing.md#execution-ownership TestEngineTabWidthDefaultsWhenZero is one Go unit entry that renders a literal Indent with Print under UseTabs and TabWidth 0 and -1 in-process; it parses no source and installs, builds and launches nothing.
func TestEngineTabWidthDefaultsWhenZero(t *testing.T) {
  doc := Indent(2, Hardline(), Text("x"))
  for _, omitted := range []int{0, -1} {
    opts := PrintOptions{PrintWidth: 80, TabWidth: omitted, UseTabs: true, EndOfLine: "lf"}
    if got := Print(doc, opts); got != "\n\tx" {
      t.Fatalf("TabWidth=%d should default to 2 (one tab), got %q", omitted, got)
    }
  }
}
