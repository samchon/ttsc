package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintArgListEmitsTrailingCommaWhenModeAll verifies the broken
// call-argument shape keeps its trailing comma under
// `trailingComma: "all"`.
//
// This entry explicitly selects `"all"` and checks the final comma in
// one overflowing three-argument call. The same input under `"es5"`
// and `"none"` is checked by the neighboring mode entries.
//
//  1. Parse `process(aaaaaaaaa, bbbbbbbbb, ccccccccc);`.
//  2. Print under PrintWidth=20 with TrailingComma="all".
//  3. Assert the rendered output ends the broken list with `ccccccccc,\n)`.
//
// @evidence contracts/testing.md#behavioral-verification printCallExpression must break the long argument list and emit the final comma under trailingComma all.
// @evidence contracts/testing.md#independent-expectations The full literal result retains process and all three identifiers in order, with an all-policy comma before the closing parenthesis.
// @evidence contracts/testing.md#distinguishing-cases An overflowing call with all mode complements the same inputs in es5 and none modes.
// @evidence contracts/testing.md#execution-ownership TestPrintArgListEmitsTrailingCommaWhenModeAll is one Go unit entry that parses a call in-process with the TypeScript-Go parser, calls printCallExpression under PrintWidth 20 and TrailingComma all, and renders the Doc with Print; it installs, builds and launches nothing.
func TestPrintArgListEmitsTrailingCommaWhenModeAll(t *testing.T) {
  file := parseTS(t, "process(aaaaaaaaa, bbbbbbbbb, ccccccccc);\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  opts.TrailingComma = "all"
  ctx := NewPrintContext(file, opts)
  doc, _ := printCallExpression(ctx, node)
  got := Print(doc, ctx.Opts)
  want := "process(\n  aaaaaaaaa,\n  bbbbbbbbb,\n  ccccccccc,\n)"
  if got != want {
    t.Fatalf("trailingComma=all call mismatch:\nwant %q\ngot  %q", want, got)
  }
}
