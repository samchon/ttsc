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
