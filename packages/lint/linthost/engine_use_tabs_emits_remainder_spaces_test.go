package linthost

import "testing"

// TestEngineUseTabsEmitsRemainderSpaces verifies that when UseTabs is
// true and the indent level is not a whole multiple of TabWidth, the
// engine emits the tab characters followed by the remaining columns as
// spaces.
//
// This is the "indent with tabs, align with spaces" convention that
// dprint and many formatters follow: whole-tab increments use tab
// characters, but any remainder (e.g. from a 3-column indent with a
// 2-column TabWidth) must be filled with spaces so that the column
// alignment is preserved even when the editor's tab-stop width differs
// from TabWidth. A regression that dropped the remainder spaces would
// misalign continuation lines in codebases that mix indented blocks
// with partial-increment alignment.
//
//  1. Build Indent(3, Hardline(), Text("x")) — indent=3, TabWidth=2
//     gives tabs=1, remainder=1.
//  2. Print with UseTabs=true, TabWidth=2.
//  3. Assert the indented line is "\n\t x" (one tab + one space).
//
// @evidence contracts/testing.md#behavioral-verification Print must emit one tab and one space for a three-column indent with TabWidth two.
// @evidence contracts/testing.md#independent-expectations Independent division gives one complete two-column tab plus one remainder column, retaining x.
// @evidence contracts/testing.md#distinguishing-cases Nonmultiple indentation complements the whole-tab indentation case.
// @evidence contracts/testing.md#execution-ownership TestEngineUseTabsEmitsRemainderSpaces is one Go unit entry that renders a literal Indent of width 3 with Print under UseTabs and TabWidth 2 in-process; it parses no source and installs, builds and launches nothing.
func TestEngineUseTabsEmitsRemainderSpaces(t *testing.T) {
  doc := Indent(3, Hardline(), Text("x"))
  opts := DefaultPrintOptions()
  opts.UseTabs = true
  opts.TabWidth = 2
  got := Print(doc, opts)
  if got != "\n\t x" {
    t.Fatalf("useTabs remainder-spaces mismatch: %q", got)
  }
}
