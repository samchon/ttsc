package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification printNamedExports must break five named exports at width twenty while retaining each binding and a final comma.
// @evidence contracts/testing.md#independent-expectations The literal expected clause preserves alpha through echo in order and follows the documented two-space broken named-list layout.
// @evidence contracts/testing.md#distinguishing-cases The overflowing five-entry clause complements the fitting two-entry exports and absent-node boundary.
// @evidence contracts/testing.md#execution-ownership TestDispatchNamedExportsBreaksWhenOverflows is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchNamedExportsBreaksWhenOverflows(t *testing.T) {
  file := parseTS(t, "export { alpha, bravo, charlie, delta, echo };\n")
  node := firstNodeOfKind(t, file, shimast.KindNamedExports)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  doc, _ := printNamedExports(ctx, node)
  got := Print(doc, ctx.Opts)
  want := "{\n  alpha,\n  bravo,\n  charlie,\n  delta,\n  echo,\n}"
  if got != want {
    t.Fatalf("broken named exports mismatch:\nwant %q\ngot  %q", want, got)
  }
}
