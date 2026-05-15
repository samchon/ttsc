package main

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
func TestDispatchNewExpressionBreaksArgumentsWhenOverflows(t *testing.T) {
  file := parseTS(t, "new Foo(aaaaaa, bbbbbb, cccccc);\n")
  node := firstNodeOfKind(t, file, shimast.KindNewExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  got := Print(printNewExpression(ctx, node), ctx.Opts)
  want := "new Foo(\n  aaaaaa,\n  bbbbbb,\n  cccccc,\n)"
  if got != want {
    t.Fatalf("broken new expression mismatch:\nwant %q\ngot  %q", want, got)
  }
}
