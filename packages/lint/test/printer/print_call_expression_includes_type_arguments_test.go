package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintCallExpressionIncludesTypeArguments verifies that a call with
// type arguments (`foo<A, B>(x)`) emits the `<A, B>` type-argument list
// verbatim between the callee and the argument list.
//
// The TypeArguments branch inside printCallExpression, together with the
// shared typeArgsStart/typeArgsEnd helpers, was uncovered by existing
// tests because all prior fixtures used unparameterised calls. Dropping
// the type-argument range would silently corrupt the emitted source for
// any generic function call.
//
// 1. Parse `foo<A, B>(x);` — a CallExpression with TypeArguments.
// 2. Print under default options.
// 3. Assert the output is `foo<A, B>(x)`.
func TestPrintCallExpressionIncludesTypeArguments(t *testing.T) {
  file := parseTS(t, "foo<A, B>(x);\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printCallExpression(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "foo<A, B>(x)" {
    t.Fatalf("type-argument call mismatch: %q", got)
  }
}
