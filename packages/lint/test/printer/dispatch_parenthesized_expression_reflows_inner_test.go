package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchParenthesizedExpressionReflowsInner verifies the
// parenthesized-expression printer dispatches its inner expression so a
// wrapped object literal still reflows.
//
// Parentheses are fixed punctuation; the reflow surface is the inner
// expression. A regression that emitted the whole `( … )` verbatim
// would freeze the inner object's columns and skip the break decision
// — `({ … })` wrapping a long literal would never reflow.
//
//  1. Parse `const x = ({ aa: 1, bb: 2, cc: 3 });`.
//  2. Dispatch the ParenthesizedExpression under printWidth=20.
//  3. Assert the parens stay attached while the inner object breaks
//     into the canonical vertical form.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must reflow the over-wide object while retaining both surrounding parentheses and report complete coverage.
// @evidence contracts/testing.md#independent-expectations The literal expected output preserves all three key/value pairs and their order while requiring the parentheses around the rewritten object.
// @evidence contracts/testing.md#distinguishing-cases A nonempty width-twenty inner expression complements nil-parenthesized-node and nil-inner factory boundaries.
// @evidence contracts/testing.md#execution-ownership TestDispatchParenthesizedExpressionReflowsInner is a plain top-level Go unit test, selectable with go test -run, that calls PrintNode directly on a parsed parenthesized object literal at width twenty inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchParenthesizedExpressionReflowsInner(t *testing.T) {
  file := parseTS(t, "const x = ({ aa: 1, bb: 2, cc: 3 });\n")
  node := firstNodeOfKind(t, file, shimast.KindParenthesizedExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("parenthesized object literal should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "({\n  aa: 1,\n  bb: 2,\n  cc: 3,\n})"
  if got != want {
    t.Fatalf("parenthesized inner reflow mismatch:\nwant %q\ngot  %q", want, got)
  }
}
