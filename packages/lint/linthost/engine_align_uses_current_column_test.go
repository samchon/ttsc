package linthost

import "testing"

// TestEngineAlignUsesCurrentColumn verifies Align increments the indent
// to the column the engine is currently emitting at, rather than to a
// fixed amount.
//
// Align is what enables continuation-line alignment such as
//
//  foo(arg1,
//      arg2)
//
// where every wrapped argument lines up under the opening paren. A
// regression that confused Align with Indent would emit a fixed 2- or
// 4-space increment instead.
//
//  1. Build Concat(Text("foo("), Align(Hardline(), Text("x")), Text(")")).
//  2. Print under default options. The first line is `foo(` (column 4
//     after emit), the Hardline inside Align then indents the next
//     line to column 4.
//  3. Assert the inner line is `    x`.
//
// @evidence contracts/testing.md#behavioral-verification Print must indent x beneath column four after foo(, rather than using a fixed indent increment.
// @evidence contracts/testing.md#independent-expectations The literal foo( followed by four spaces and x) follows Align capturing the emitted prefix column.
// @evidence contracts/testing.md#distinguishing-cases This continuation alignment differs from the fixed two-column Indent case.
// @evidence contracts/testing.md#execution-ownership TestEngineAlignUsesCurrentColumn is one Go unit entry that builds a literal Doc tree with Align and renders it with Print in-process; it parses no source and installs, builds and launches nothing.
func TestEngineAlignUsesCurrentColumn(t *testing.T) {
  doc := Concat(Text("foo("), Align(Hardline(), Text("x")), Text(")"))
  got := Print(doc, DefaultPrintOptions())
  if got != "foo(\n    x)" {
    t.Fatalf("align mismatch: %q", got)
  }
}
