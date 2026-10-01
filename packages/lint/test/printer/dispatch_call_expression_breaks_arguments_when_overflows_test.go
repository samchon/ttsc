package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification printCallExpression must break the three long identifiers at width twenty.
// @evidence contracts/testing.md#independent-expectations The literal output preserves process and the exact argument names/order with the documented broken-list comma policy.
// @evidence contracts/testing.md#distinguishing-cases The overflowing argument list complements the short flat foo call and last-argument hugging cases.
// @evidence contracts/testing.md#execution-ownership TestDispatchCallExpressionBreaksArgumentsWhenOverflows is a plain top-level Go unit test, selectable with go test -run, that calls printCallExpression directly on a parsed three-identifier call at width twenty inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchCallExpressionBreaksArgumentsWhenOverflows(t *testing.T) {
  file := parseTS(t, "process(aaaaaaaaa, bbbbbbbbb, ccccccccc);\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  doc, _ := printCallExpression(ctx, node)
  got := Print(doc, ctx.Opts)
  want := "process(\n  aaaaaaaaa,\n  bbbbbbbbb,\n  ccccccccc,\n)"
  if got != want {
    t.Fatalf("broken call mismatch:\nwant %q\ngot  %q", want, got)
  }
}
