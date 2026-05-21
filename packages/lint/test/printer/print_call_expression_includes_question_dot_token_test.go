package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintCallExpressionIncludesQuestionDotToken verifies that an
// optional-chain call (`foo?.(x)`) emits the `?.` token verbatim between
// the callee and the argument list.
//
// The QuestionDotToken branch inside printCallExpression was uncovered by
// the flat-/broken-call tests because those fixtures use ordinary calls
// without the optional-chain syntax. A regression that silently dropped
// `?.` would convert `foo?.(x)` to `foo(x)`, changing runtime behaviour
// for nullish receivers.
//
// 1. Parse `foo?.(x);` — a CallExpression with a QuestionDotToken.
// 2. Print under default options.
// 3. Assert the output is `foo?.(x)`.
func TestPrintCallExpressionIncludesQuestionDotToken(t *testing.T) {
  file := parseTS(t, "foo?.(x);\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printCallExpression(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "foo?.(x)" {
    t.Fatalf("optional-chain call mismatch: %q", got)
  }
}
