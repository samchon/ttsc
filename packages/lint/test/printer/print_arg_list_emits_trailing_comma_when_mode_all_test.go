package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintArgListEmitsTrailingCommaWhenModeAll verifies the broken
// call-argument shape keeps its trailing comma under
// `trailingComma: "all"`.
//
// `"all"` is the engine default and the historical hard-coded shape:
// every multi-line argument list ends with `,\n)`. The test pins the
// default arm of the new `printArgList` AddComma plumbing so a later
// refactor — once the trailingComma plumbing exists — cannot silently
// flip the default to `none` and strip a comma rxjs (configured for
// `"all"`) and every other Prettier-default project depend on.
//
//  1. Parse `process(aaaaaaaaa, bbbbbbbbb, ccccccccc);`.
//  2. Print under PrintWidth=20 with TrailingComma="all".
//  3. Assert the rendered output ends the broken list with `ccccccccc,\n)`.
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
