package linthost

import "testing"

// TestEngineAlignUsesCurrentColumn verifies Align replaces the child newline
// indentation target with the current output column. Literal foo( puts that
// target at four. A different seven-column prefix with parent BaseIndent
// three must instead indent to seven, not four or ten.
//
// @evidence contracts/testing.md#behavioral-verification Print must indent x beneath column four after foo( and seven after prefix(, replacing rather than adding parent BaseIndent three.
// @evidence contracts/testing.md#independent-expectations Authored foo( plus four spaces and prefix( plus seven spaces follow their literal prefix lengths, independently of the renderer; parent indentation three changes neither target.
// @evidence contracts/testing.md#distinguishing-cases Different prefix lengths and zero/nonzero parent BaseIndent distinguish absolute current-column replacement from a fixed target or addition to parent indentation; fixed Indent has a sibling control.
// @evidence contracts/testing.md#execution-ownership TestEngineAlignUsesCurrentColumn is one Go unit entry that renders an authored Align Doc with Print under zero and nonzero BaseIndent in-process; it parses no source and installs, builds and launches nothing.
func TestEngineAlignUsesCurrentColumn(t *testing.T) {
  doc := Concat(Text("foo("), Align(Hardline(), Text("x")), Text(")"))
  got := Print(doc, DefaultPrintOptions())
  if got != "foo(\n    x)" {
    t.Fatalf("align mismatch: %q", got)
  }
  opts := DefaultPrintOptions()
  opts.BaseIndent = 3
  doc = Concat(Text("prefix("), Align(Hardline(), Text("x")), Text(")"))
  got = Print(doc, opts)
  if got != "prefix(\n       x)" {
    t.Fatalf("Align must replace parent indentation with the actual column: got %q", got)
  }
}
