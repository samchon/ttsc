package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintArgListOmitsTrailingCommaWhenModeEs5 verifies the broken
// call-argument shape drops its trailing comma under
// `trailingComma: "es5"`.
//
// Prettier's `es5` policy excludes call-argument trailing commas.
// This entry explicitly selects that policy for an overflowing call
// and checks the complete output, including the absent final comma.
//
//  1. Parse `process(aaaaaaaaa, bbbbbbbbb, ccccccccc);`.
//  2. Print under PrintWidth=20 with TrailingComma="es5".
//  3. Assert the rendered output ends the broken list with `ccccccccc\n)`
//     — no trailing comma after the last argument.
//
// @evidence contracts/testing.md#behavioral-verification printCallExpression must break the long arguments without a final call comma under es5 policy.
// @evidence contracts/testing.md#independent-expectations The literal output retains the callee and each argument; es5 excludes call-argument trailing commas independently of line width.
// @evidence contracts/testing.md#distinguishing-cases The same overflowing call with es5 differs from all only in final punctuation; none is checked separately.
// @evidence contracts/testing.md#execution-ownership TestPrintArgListOmitsTrailingCommaWhenModeEs5 is one Go unit entry that parses a call in-process with the TypeScript-Go parser, calls printCallExpression under PrintWidth 20 and TrailingComma es5, and renders the Doc with Print; it installs, builds and launches nothing.
func TestPrintArgListOmitsTrailingCommaWhenModeEs5(t *testing.T) {
  file := parseTS(t, "process(aaaaaaaaa, bbbbbbbbb, ccccccccc);\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  opts.TrailingComma = "es5"
  ctx := NewPrintContext(file, opts)
  doc, _ := printCallExpression(ctx, node)
  got := Print(doc, ctx.Opts)
  want := "process(\n  aaaaaaaaa,\n  bbbbbbbbb,\n  ccccccccc\n)"
  if got != want {
    t.Fatalf("trailingComma=es5 call mismatch:\nwant %q\ngot  %q", want, got)
  }
}
