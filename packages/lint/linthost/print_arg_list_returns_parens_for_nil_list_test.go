package linthost

import (
  "testing"
)

// TestPrintArgListReturnsParensForNilList verifies that printArgList
// returns the text `()` when given a nil NodeList.
//
// The direct nil-list path returns the empty delimiters without inspecting
// argument elements. This entry supplies nil explicitly; the parsed source
// only provides the PrintContext.
//
// 1. Call printArgList directly with a nil list pointer.
// 2. Print the resulting Doc under default options.
// 3. Assert the output is exactly `()`.
//
// @evidence contracts/testing.md#behavioral-verification printArgList must render the empty argument delimiters when its list is nil.
// @evidence contracts/testing.md#independent-expectations The empty-call grammar requires the literal (), not missing punctuation or a stray comma.
// @evidence contracts/testing.md#distinguishing-cases A nil argument list emits empty delimiters directly, complementing the nonempty flat/broken call cases.
// @evidence contracts/testing.md#execution-ownership TestPrintArgListReturnsParensForNilList is one Go unit entry that parses a trivial source for a PrintContext, calls the unexported printArgList with a nil list and renders the Doc with Print in-process; it installs, builds and launches nothing.
func TestPrintArgListReturnsParensForNilList(t *testing.T) {
  file := parseTS(t, "foo();\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printArgList(ctx, nil, true, false, false)
  got := Print(doc, ctx.Opts)
  if got != "()" {
    t.Fatalf("printArgList(nil): expected \"()\", got %q", got)
  }
}
