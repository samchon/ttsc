package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification printNamedImports must break five import bindings at width twenty and preserve their order and final comma.
// @evidence contracts/testing.md#independent-expectations The authored expected clause follows the documented broken list layout and preserves alpha through echo exactly.
// @evidence contracts/testing.md#distinguishing-cases The overflowing clause complements fitting named imports and nil/malformed list boundaries.
// @evidence contracts/testing.md#execution-ownership TestDispatchNamedImportsBreaksWhenOverflows is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchNamedImportsBreaksWhenOverflows(t *testing.T) {
  file := parseTS(t, "import { alpha, bravo, charlie, delta, echo } from \"x\";\n")
  node := firstNodeOfKind(t, file, shimast.KindNamedImports)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  doc, _ := printNamedImports(ctx, node)
  got := Print(doc, ctx.Opts)
  want := "{\n  alpha,\n  bravo,\n  charlie,\n  delta,\n  echo,\n}"
  if got != want {
    t.Fatalf("broken named imports mismatch:\nwant %q\ngot  %q", want, got)
  }
}
