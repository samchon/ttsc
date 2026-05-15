package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchCallExpressionBreaksArgumentsWhenOverflows verifies a call
// whose flat argument list exceeds the budget reflows arguments onto
// indented lines.
//
// The case is the call-expression analogue of the broken-object and
// broken-array cases. It exists separately so a regression that only
// broke the object/array surface would not silently pass: call
// expressions thread the callee through verbatim before reaching
// printList, so the printer has a different glue path.
//
//  1. Parse `process(aaaaaaaaa, bbbbbbbbb, ccccccccc);`.
//  2. Print under printWidth=20.
//  3. Assert the call breaks into one argument per line with trailing
//     comma.
func TestDispatchCallExpressionBreaksArgumentsWhenOverflows(t *testing.T) {
  file := parseTS(t, "process(aaaaaaaaa, bbbbbbbbb, ccccccccc);\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  got := Print(printCallExpression(ctx, node), ctx.Opts)
  want := "process(\n  aaaaaaaaa,\n  bbbbbbbbb,\n  ccccccccc,\n)"
  if got != want {
    t.Fatalf("broken call mismatch:\nwant %q\ngot  %q", want, got)
  }
}
