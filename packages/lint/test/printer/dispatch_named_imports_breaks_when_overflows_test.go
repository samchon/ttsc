package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNamedImportsBreaksWhenOverflows verifies a long
// `{ … }` import clause reflows onto multiple indented lines.
//
// The headline use case for `format/print-width` on the import side:
// projects with sprawling barrel re-exports want the same multi-line
// rendering Prettier produces. Without this case, an `error`-class
// severity could regress to a single-line output.
//
//  1. Parse an import with five specifiers each ~7 chars long.
//  2. Print under printWidth=20.
//  3. Assert the result is the expected multi-line shape with a
//     trailing comma after the last specifier.
func TestDispatchNamedImportsBreaksWhenOverflows(t *testing.T) {
  file := parseTS(t, "import { alpha, bravo, charlie, delta, echo } from \"x\";\n")
  node := firstNodeOfKind(t, file, shimast.KindNamedImports)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  got := Print(printNamedImports(ctx, node), ctx.Opts)
  want := "{\n  alpha,\n  bravo,\n  charlie,\n  delta,\n  echo,\n}"
  if got != want {
    t.Fatalf("broken named imports mismatch:\nwant %q\ngot  %q", want, got)
  }
}
