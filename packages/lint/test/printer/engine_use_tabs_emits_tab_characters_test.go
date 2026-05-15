package main

import "testing"

// TestEngineUseTabsEmitsTabCharacters verifies the UseTabs option swaps
// space indentation for tab characters in newline emissions.
//
// `useTabs: true` is a non-default config but matches a common
// codebase preference (and Prettier's own `useTabs` option). The
// fixture forces a break with an Indent of width 2 (one tab at
// TabWidth=2) and asserts the engine emits `\t` rather than two
// spaces — the dprint convention is "indent with tabs, align with
// spaces", which this case exercises at the indent-only level.
//
//  1. Build Indent(2, Hardline, Text("x")).
//  2. Print with UseTabs=true.
//  3. Assert the indented line is `\tx`.
func TestEngineUseTabsEmitsTabCharacters(t *testing.T) {
  doc := Indent(2, Hardline(), Text("x"))
  opts := DefaultPrintOptions()
  opts.UseTabs = true
  got := Print(doc, opts)
  if got != "\n\tx" {
    t.Fatalf("useTabs indent mismatch: %q", got)
  }
}
