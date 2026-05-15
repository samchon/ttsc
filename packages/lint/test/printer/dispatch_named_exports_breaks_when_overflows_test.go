package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNamedExportsBreaksWhenOverflows verifies a long
// `export { … }` re-export reflows specifiers across lines.
//
// Symmetric partner of the named-exports flat case. Pinning the
// broken-form output here ensures a regression specific to the
// NamedExports dispatch branch (which differs from NamedImports
// only in surrounding context) cannot slip in unnoticed.
//
//  1. Parse `export { alpha, bravo, charlie, delta, echo };`.
//  2. Print under printWidth=20.
//  3. Assert the result is the canonical broken clause with a
//     trailing comma after the last specifier.
func TestDispatchNamedExportsBreaksWhenOverflows(t *testing.T) {
  file := parseTS(t, "export { alpha, bravo, charlie, delta, echo };\n")
  node := firstNodeOfKind(t, file, shimast.KindNamedExports)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  got := Print(printNamedExports(ctx, node), ctx.Opts)
  want := "{\n  alpha,\n  bravo,\n  charlie,\n  delta,\n  echo,\n}"
  if got != want {
    t.Fatalf("broken named exports mismatch:\nwant %q\ngot  %q", want, got)
  }
}
