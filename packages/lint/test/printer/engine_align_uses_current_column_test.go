package main

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
func TestEngineAlignUsesCurrentColumn(t *testing.T) {
  doc := Concat(Text("foo("), Align(Hardline(), Text("x")), Text(")"))
  got := Print(doc, DefaultPrintOptions())
  if got != "foo(\n    x)" {
    t.Fatalf("align mismatch: %q", got)
  }
}
