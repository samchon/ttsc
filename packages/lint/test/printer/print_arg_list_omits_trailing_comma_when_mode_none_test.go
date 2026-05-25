package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintArgListOmitsTrailingCommaWhenModeNone verifies the broken
// call-argument shape drops its trailing comma under
// `trailingComma: "none"`.
//
// `"none"` is the strictest mode: every list position — calls,
// arrays, objects, named imports / exports — must render without a
// trailing comma. The `formatTrailingComma` rule short-circuits at
// the top of `Check` when the option resolves to "none", so the
// printer must agree on the same shape or the printer would keep
// reinserting the comma on every cascade pass.
//
//  1. Parse `process(aaaaaaaaa, bbbbbbbbb, ccccccccc);`.
//  2. Print under PrintWidth=20 with TrailingComma="none".
//  3. Assert the rendered output ends the broken list with `ccccccccc\n)`
//     — no trailing comma after the last argument.
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
