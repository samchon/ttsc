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
//
// @evidence contracts/testing.md#behavioral-verification printNewExpression must retain new Foo without inventing an argument list.
// @evidence contracts/testing.md#independent-expectations JavaScript new Foo is a valid no-parentheses construction; the literal fixture specifies the intended source preservation.
// @evidence contracts/testing.md#distinguishing-cases An absent argument list differs from a present empty list and nonempty type-argument constructors. Only the absent form is asserted here.
// @evidence contracts/testing.md#execution-ownership TestPrintNewExpressionOmitsArgumentListWhenAbsent is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
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
