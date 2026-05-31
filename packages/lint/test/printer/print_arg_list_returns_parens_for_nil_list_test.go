package linthost

import (
  "testing"
)

// TestPrintArgListReturnsParensForNilList verifies that printArgList
// returns the text `()` when given a nil NodeList.
//
// The nil guard in printArgList is a protective fast-path: a nil argument
// list means there are no parentheses yet, so the printer emits the bare
// empty-parens string without delegating to printList. Existing call and
// new-expression tests always supply a non-nil list, leaving this guard
// uncovered.
//
// 1. Call printArgList directly with a nil list pointer.
// 2. Print the resulting Doc under default options.
// 3. Assert the output is exactly `()`.
func TestPrintArgListReturnsParensForNilList(t *testing.T) {
  file := parseTS(t, "foo();\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printArgList(ctx, nil, true, false, false)
  got := Print(doc, ctx.Opts)
  if got != "()" {
    t.Fatalf("printArgList(nil): expected \"()\", got %q", got)
  }
}
