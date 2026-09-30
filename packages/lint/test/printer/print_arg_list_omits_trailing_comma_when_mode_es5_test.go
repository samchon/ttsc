package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintArgListOmitsTrailingCommaWhenModeEs5 verifies the broken
// call-argument shape drops its trailing comma under
// `trailingComma: "es5"`.
//
// Trailing commas in call arguments arrived in ES2017, so Prettier's
// `es5` mode excludes them — the `format/trailing-comma` rule's
// `KindCallExpression` arm has always honored that. The printer used
// to add the comma back on every reflow, which oscillated against
// Prettier on every benchmark pass (rxjs hit this on `ajax.ts`,
// `bindCallbackInternals.ts`, several operators, and the
// `testing/Cold|HotObservable.ts` files). This test pins the new
// `printArgList` branch that consults `PrintOptions.TrailingComma`.
//
//  1. Parse `process(aaaaaaaaa, bbbbbbbbb, ccccccccc);`.
//  2. Print under PrintWidth=20 with TrailingComma="es5".
//  3. Assert the rendered output ends the broken list with `ccccccccc\n)`
//     — no trailing comma after the last argument.
//
// @evidence contracts/testing.md#behavioral-verification printCallExpression must break the long arguments without a final call comma under es5 policy.
// @evidence contracts/testing.md#independent-expectations The literal output retains the callee and each argument; es5 excludes call-argument trailing commas independently of line width.
// @evidence contracts/testing.md#distinguishing-cases The same overflowing call with es5 differs from all only in final punctuation; none is checked separately.
// @evidence contracts/testing.md#execution-ownership TestPrintArgListOmitsTrailingCommaWhenModeEs5 is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
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
