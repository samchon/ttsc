package linthost

import "testing"

// TestEngineUseTabsEmitsTabCharacters verifies that UseTabs emits one
// tab for an Indent of two under the default TabWidth of two.
//
// Hardline forces a newline in this direct Doc fixture. The literal
// newline-tab-x distinguishes the tab byte from two space bytes; it
// does not exercise configuration loading or a parsed source node.
//
// @evidence contracts/testing.md#behavioral-verification Print must emit a tab instead of two spaces after the hard break when UseTabs is true.
// @evidence contracts/testing.md#independent-expectations Default TabWidth two makes Indent two one tab; the literal newline-tab-x checks exact bytes.
// @evidence contracts/testing.md#distinguishing-cases A whole indent step complements the three-column remainder-space case.
// @evidence contracts/testing.md#execution-ownership TestEngineUseTabsEmitsTabCharacters is one Go unit entry that renders a literal Indent of width 2 with Print under UseTabs in-process; it parses no source and installs, builds and launches nothing.
func TestEngineUseTabsEmitsTabCharacters(t *testing.T) {
  doc := Indent(2, Hardline(), Text("x"))
  opts := DefaultPrintOptions()
  opts.UseTabs = true
  got := Print(doc, opts)
  if got != "\n\tx" {
    t.Fatalf("useTabs indent mismatch: %q", got)
  }
}
