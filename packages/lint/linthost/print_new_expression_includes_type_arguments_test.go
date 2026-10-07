package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintNewExpressionIncludesTypeArguments verifies that a new-expression
// with type arguments (`new Foo<A, B>(x)`) emits the `<A, B>` range
// verbatim between the constructor expression and the argument list.
//
// The TypeArguments branch of printNewExpression and the shared
// typeArgsStart/typeArgsEnd helpers need a NewExpression carrying a
// TypeArguments list to be reached. A regression
// that dropped the type-argument range would silently corrupt source for
// any generic constructor call.
//
// 1. Parse `new Foo<A, B>(x);` — a NewExpression with TypeArguments.
// 2. Print under default options.
// 3. Assert the output is `new Foo<A, B>(x)`.
//
// @evidence contracts/testing.md#behavioral-verification printNewExpression must preserve new Foo<A, B>(x), including the generic arguments.
// @evidence contracts/testing.md#independent-expectations The authored source literal independently fixes constructor name, type order, runtime argument and punctuation.
// @evidence contracts/testing.md#distinguishing-cases Explicit type arguments complement the no-argument-list constructor and malformed argument fallback.
// @evidence contracts/testing.md#execution-ownership TestPrintNewExpressionIncludesTypeArguments is one Go unit entry that parses a generic new expression in-process with the TypeScript-Go parser, calls printNewExpression and renders the Doc with Print; it installs, builds and launches nothing.
func TestPrintNewExpressionIncludesTypeArguments(t *testing.T) {
  file := parseTS(t, "new Foo<A, B>(x);\n")
  node := firstNodeOfKind(t, file, shimast.KindNewExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printNewExpression(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "new Foo<A, B>(x)" {
    t.Fatalf("new expression with type arguments mismatch: %q", got)
  }
}
