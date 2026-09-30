package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchArrayLiteralBreaksWhenOverflows verifies a long array
// reflows across lines under a tight `printWidth`.
//
// The symmetric partner of the object-broken case. Both literals
// share the same printList machinery, so this test would catch a
// shape-class divergence (e.g. forgetting trailing commas only on
// arrays).
//
//  1. Parse a source with a six-element array of long strings.
//  2. Print under printWidth=20 to force a break.
//  3. Assert each element is on its own indented line with a trailing
//     comma after the last.
//
// @evidence contracts/testing.md#behavioral-verification printArrayLiteral must break the three string elements at width twenty without changing their spelling or order.
// @evidence contracts/testing.md#independent-expectations The literal alpha/beta/gamma array exceeds the budget and the documented list layout uses two-space indentation and a final comma.
// @evidence contracts/testing.md#distinguishing-cases The overflowing string array complements the fitting numeric-array case; this case retains every literal value.
// @evidence contracts/testing.md#execution-ownership TestDispatchArrayLiteralBreaksWhenOverflows is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchArrayLiteralBreaksWhenOverflows(t *testing.T) {
  file := parseTS(t, "const x = [\"alpha\", \"beta\", \"gamma\"];\n")
  node := firstNodeOfKind(t, file, shimast.KindArrayLiteralExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  doc, _ := printArrayLiteral(ctx, node)
  got := Print(doc, ctx.Opts)
  want := "[\n  \"alpha\",\n  \"beta\",\n  \"gamma\",\n]"
  if got != want {
    t.Fatalf("broken array mismatch:\nwant %q\ngot  %q", want, got)
  }
}
