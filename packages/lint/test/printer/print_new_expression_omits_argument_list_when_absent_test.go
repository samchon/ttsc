package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintNewExpressionOmitsArgumentListWhenAbsent verifies that
// printNewExpression renders `new Foo` (without parentheses) when the
// NewExpression has no argument list.
//
// TypeScript allows `new Foo` without parentheses when no arguments are
// needed. The Arguments field is nil in that case. The ne.Arguments nil
// check in printNewExpression guards against delegating to printArgList
// with a nil list and emitting spurious `()`. All prior new-expression
// tests supplied arguments, leaving this branch uncovered.
//
// 1. Parse `new Foo;` — a NewExpression with nil Arguments.
// 2. Print under default options.
// 3. Assert the output is `new Foo` (no parentheses).
func TestPrintNewExpressionOmitsArgumentListWhenAbsent(t *testing.T) {
  file := parseTS(t, "new Foo;\n")
  node := firstNodeOfKind(t, file, shimast.KindNewExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printNewExpression(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "new Foo" {
    t.Fatalf("argument-less new expression mismatch: %q", got)
  }
}
