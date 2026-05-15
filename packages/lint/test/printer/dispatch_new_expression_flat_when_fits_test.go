package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNewExpressionFlatWhenFits verifies the `new`-expression
// per-node printer keeps short constructions on a single line and
// preserves the `new ` keyword prefix.
//
// `printNewExpression` mirrors `printCallExpression` but prepends
// `new `. A regression that dropped the keyword would convert
// `new Foo(a)` to `Foo(a)` and silently change runtime semantics.
// The case pins the keyword and the flat-form shape end-to-end.
//
//  1. Parse `new Foo(a, b);`.
//  2. Dispatch the NewExpression node directly.
//  3. Assert the rendered output is `new Foo(a, b)`.
func TestDispatchNewExpressionFlatWhenFits(t *testing.T) {
  file := parseTS(t, "new Foo(a, b);\n")
  node := firstNodeOfKind(t, file, shimast.KindNewExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  got := Print(printNewExpression(ctx, node), ctx.Opts)
  if got != "new Foo(a, b)" {
    t.Fatalf("flat new expression mismatch: %q", got)
  }
}
