package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchCallBreaksExpressionBodyArrowArgumentWhenOverflows verifies
// a call whose sole argument is an expression-bodied arrow explodes the
// argument list onto its own line when the flat call overflows the
// printWidth budget.
//
// This arrow's comparison body has no structural break point and is
// excluded from last-argument hugging, allowing the ordinary argument
// list Group to break. Other expression bodies, such as calls or
// conditionals, can qualify for hugging. This test asserts the direct
// printer result, not a `ttsc format` pass or historical behavior.
//
//  1. Parse `stocks.find((stock) => stock.id === wantedId);`.
//  2. Dispatch the CallExpression through PrintNode under printWidth=24.
//  3. Assert the argument list breaks: the arrow lands on its own
//     indented line with a trailing comma.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must break stocks.find around its expression-bodied arrow at width twenty-four and report full coverage.
// @evidence contracts/testing.md#independent-expectations The full literal output retains stock, its id comparison and wantedId; only call delimiters and layout change.
// @evidence contracts/testing.md#distinguishing-cases An expression-bodied callback that overflows differs from block-body hugging and short flat calls.
// @evidence contracts/testing.md#execution-ownership TestDispatchCallBreaksExpressionBodyArrowArgumentWhenOverflows is a plain top-level Go unit test, selectable with go test -run, that calls PrintNode directly on a parsed call with an expression-bodied arrow argument at width twenty-four inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchCallBreaksExpressionBodyArrowArgumentWhenOverflows(t *testing.T) {
  file := parseTS(t, "stocks.find((stock) => stock.id === wantedId);\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 24
  ctx := NewPrintContext(file, opts)
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("expression-body arrow argument should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "stocks.find(\n  (stock) => stock.id === wantedId,\n)"
  if got != want {
    t.Fatalf("expression-body arrow call mismatch:\nwant %q\ngot  %q", want, got)
  }
}
