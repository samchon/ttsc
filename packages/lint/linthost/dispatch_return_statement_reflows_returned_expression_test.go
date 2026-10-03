package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchReturnStatementReflowsReturnedExpression verifies the
// return-statement printer dispatches the returned expression so a
// returned object literal reflows under the budget.
//
// A `return` statement inside a callback body is the second common
// statement shape after a plain expression statement. The printer emits
// the `return` keyword as fixed text and dispatches the expression, so
// a returned literal that overflows still breaks. A regression that
// emitted the whole statement verbatim would freeze the literal's
// columns and skip the break decision.
//
//  1. Parse a `return { … };` statement whose object literal overflows
//     printWidth=20.
//  2. Dispatch the ReturnStatement through PrintNode.
//  3. Assert the `return` keyword stays put while the object breaks
//     into the canonical vertical form.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must break the returned object while retaining return, all properties and its semicolon, and report full coverage.
// @evidence contracts/testing.md#independent-expectations The exact literal expected statement independently fixes return grammar and property values/order; only layout changes.
// @evidence contracts/testing.md#distinguishing-cases An over-wide returned object complements bare-return and comment-bearing-tail verbatim fallbacks.
// @evidence contracts/testing.md#execution-ownership TestDispatchReturnStatementReflowsReturnedExpression is a plain top-level Go unit test, selectable with go test -run, that calls PrintNode directly on a parsed return statement with an over-wide object literal at width twenty inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchReturnStatementReflowsReturnedExpression(t *testing.T) {
  file := parseTS(t, "function f() {\n  return { aa: 1, bb: 2, cc: 3 };\n}\n")
  node := firstNodeOfKind(t, file, shimast.KindReturnStatement)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("return of object literal should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "return {\n  aa: 1,\n  bb: 2,\n  cc: 3,\n};"
  if got != want {
    t.Fatalf("return statement reflow mismatch:\nwant %q\ngot  %q", want, got)
  }
}
