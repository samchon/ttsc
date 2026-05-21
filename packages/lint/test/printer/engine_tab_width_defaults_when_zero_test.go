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
func TestEngineTabWidthDefaultsWhenZero(t *testing.T) {
  doc := Indent(2, Hardline(), Text("x"))
  opts := PrintOptions{PrintWidth: 80, TabWidth: 0, UseTabs: true, EndOfLine: "lf"}
  got := Print(doc, opts)
  if got != "\n\tx" {
    t.Fatalf("zero TabWidth should default to 2 (one tab), got %q", got)
  }
}
