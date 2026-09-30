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
// This pins the shouldHugLastArgument fix. An expression-bodied arrow
// has no internal break point, so the last-argument-hugging shape
// (printListHuggingLast — a flat Concat with no Group) pinned such a
// call to one line at every width: `ttsc format` would collapse an
// already-broken, fitting call into a single line that overflows
// printWidth. Excluding expression-bodied arrows from hugging routes
// the argument through the normal list Group, which can break.
//
//  1. Parse `stocks.find((stock) => stock.id === wantedId);`.
//  2. Dispatch the CallExpression through PrintNode under printWidth=24.
//  3. Assert the argument list breaks: the arrow lands on its own
//     indented line with a trailing comma.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must break stocks.find around its expression-bodied arrow at width twenty-four and report full coverage.
// @evidence contracts/testing.md#independent-expectations The full literal output retains stock, its id comparison and wantedId; only call delimiters and layout change.
// @evidence contracts/testing.md#distinguishing-cases An expression-bodied callback that overflows differs from block-body hugging and short flat calls.
// @evidence contracts/testing.md#execution-ownership TestDispatchCallBreaksExpressionBodyArrowArgumentWhenOverflows is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
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
