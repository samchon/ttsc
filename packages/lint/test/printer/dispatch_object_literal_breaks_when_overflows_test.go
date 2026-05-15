package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchObjectLiteralBreaksWhenOverflows verifies an object whose
// flat projection exceeds the column budget renders broken across
// lines with a trailing comma and proper indentation.
//
// The case pins the headline reflow behavior: the same input flips
// from flat to broken purely based on `printWidth`. A regression that
// failed to inject the trailing comma in broken mode (Prettier's
// `trailingComma: "all"` default) would fail this assertion.
//
//  1. Parse a source whose object literal has three two-letter keys
//     mapping to short values — flat width ~30 chars.
//  2. Print under printWidth=20 to force the break.
//  3. Assert the result has the three properties indented two spaces
//     each, each terminated by a comma (including the last).
func TestDispatchObjectLiteralBreaksWhenOverflows(t *testing.T) {
  file := parseTS(t, "const x = { aa: 1, bb: 2, cc: 3 };\n")
  node := firstNodeOfKind(t, file, shimast.KindObjectLiteralExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  got := Print(printObjectLiteral(ctx, node), ctx.Opts)
  want := "{\n  aa: 1,\n  bb: 2,\n  cc: 3,\n}"
  if got != want {
    t.Fatalf("broken object mismatch:\nwant %q\ngot  %q", want, got)
  }
}
