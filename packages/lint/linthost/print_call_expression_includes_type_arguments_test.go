package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintCallExpressionIncludesTypeArguments verifies that a call with
// type arguments (`foo<A, B>(x)`) emits the `<A, B>` type-argument list
// verbatim between the callee and the argument list.
//
// This fixture exercises the TypeArguments branch and its
// typeArgsStart/typeArgsEnd boundaries with two explicit type arguments.
// The full expected source distinguishes dropped names or delimiters.
//
// 1. Parse `foo<A, B>(x);` — a CallExpression with TypeArguments.
// 2. Print under default options.
// 3. Assert the output is `foo<A, B>(x)`.
//
// @evidence contracts/testing.md#behavioral-verification printCallExpression must retain both explicit type arguments in foo<A, B>(x).
// @evidence contracts/testing.md#independent-expectations The source literal independently fixes generic argument names, order and delimiters as well as runtime x.
// @evidence contracts/testing.md#distinguishing-cases A typed call complements ordinary and optional calls without type arguments.
// @evidence contracts/testing.md#execution-ownership TestPrintCallExpressionIncludesTypeArguments is one Go unit entry that parses a generic call in-process with the TypeScript-Go parser, calls printCallExpression and renders the Doc with Print; it installs, builds and launches nothing.
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
