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
//
// @evidence contracts/testing.md#behavioral-verification printCallExpression must preserve the optional-call token in foo?.(x).
// @evidence contracts/testing.md#independent-expectations The literal optional-call fixture supplies independently meaningful ?. punctuation; losing it changes conditional call behavior.
// @evidence contracts/testing.md#distinguishing-cases The optional-call case complements the ordinary foo(a, b) flat call.
// @evidence contracts/testing.md#execution-ownership TestPrintCallExpressionIncludesQuestionDotToken is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
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
