package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintArgListOmitsTrailingCommaWhenModeNone verifies the broken
// call-argument shape drops its trailing comma under
// `trailingComma: "none"`.
//
// This entry explicitly selects the no-trailing-comma policy for one
// overflowing call. It checks the complete result directly; other list
// positions and command formatting cascades are outside this test.
//
//  1. Parse `process(aaaaaaaaa, bbbbbbbbb, ccccccccc);`.
//  2. Print under PrintWidth=20 with TrailingComma="none".
//  3. Assert the rendered output ends the broken list with `ccccccccc\n)`
//     — no trailing comma after the last argument.
//
// @evidence contracts/testing.md#behavioral-verification printCallExpression must break the long argument list and omit a final comma under none policy.
// @evidence contracts/testing.md#independent-expectations The full expected call source retains its three arguments and requires the explicit no-comma policy.
// @evidence contracts/testing.md#distinguishing-cases None mode complements all and es5 on identical argument inputs.
// @evidence contracts/testing.md#execution-ownership TestPrintArgListOmitsTrailingCommaWhenModeNone is one Go unit entry that parses a call in-process with the TypeScript-Go parser, calls printCallExpression under PrintWidth 20 and TrailingComma none, and renders the Doc with Print; it installs, builds and launches nothing.
func TestPrintArgListOmitsTrailingCommaWhenModeNone(t *testing.T) {
  file := parseTS(t, "process(aaaaaaaaa, bbbbbbbbb, ccccccccc);\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  opts.TrailingComma = "none"
  ctx := NewPrintContext(file, opts)
  doc, _ := printCallExpression(ctx, node)
  got := Print(doc, ctx.Opts)
  want := "process(\n  aaaaaaaaa,\n  bbbbbbbbb,\n  ccccccccc\n)"
  if got != want {
    t.Fatalf("trailingComma=none call mismatch:\nwant %q\ngot  %q", want, got)
  }
}
