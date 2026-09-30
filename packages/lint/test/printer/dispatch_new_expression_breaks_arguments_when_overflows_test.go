package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNewExpressionBreaksArgumentsWhenOverflows verifies the
// `new`-expression printer reflows arguments across lines when the
// flat form exceeds the budget.
//
// The symmetric partner of the new-expression flat-fits case. Both
// new and call expressions thread the callee verbatim into the
// argument list, but they take separate dispatcher branches; this
// pair makes a regression on either branch visible immediately.
//
//  1. Parse `new Foo(aaaaaa, bbbbbb, cccccc);` (~33 chars wide).
//  2. Print under printWidth=20.
//  3. Assert each argument occupies its own indented line and the
//     `new ` keyword survives on the head line.
//
// @evidence contracts/testing.md#behavioral-verification printNewExpression must break long constructor arguments at width twenty while retaining new Foo and all operands.
// @evidence contracts/testing.md#independent-expectations The literal constructor layout preserves each identifier in order and follows the supported broken argument-list punctuation.
// @evidence contracts/testing.md#distinguishing-cases The overflowing constructor complements the fitting new Foo(a, b) case and no-parentheses construction.
// @evidence contracts/testing.md#execution-ownership TestDispatchNewExpressionBreaksArgumentsWhenOverflows is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchNewExpressionBreaksArgumentsWhenOverflows(t *testing.T) {
  file := parseTS(t, "new Foo(aaaaaa, bbbbbb, cccccc);\n")
  node := firstNodeOfKind(t, file, shimast.KindNewExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  doc, _ := printNewExpression(ctx, node)
  got := Print(doc, ctx.Opts)
  want := "new Foo(\n  aaaaaa,\n  bbbbbb,\n  cccccc,\n)"
  if got != want {
    t.Fatalf("broken new expression mismatch:\nwant %q\ngot  %q", want, got)
  }
}
