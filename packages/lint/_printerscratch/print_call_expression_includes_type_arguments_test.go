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
//
// @evidence contracts/testing.md#behavioral-verification printCallExpression must retain both explicit type arguments in foo<A, B>(x).
// @evidence contracts/testing.md#independent-expectations The source literal independently fixes generic argument names, order and delimiters as well as runtime x.
// @evidence contracts/testing.md#distinguishing-cases A typed call complements ordinary and optional calls without type arguments.
// @evidence contracts/testing.md#execution-ownership TestPrintCallExpressionIncludesTypeArguments is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
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
