package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchExpressionStatementReturnsVerbatimForDirtyTail verifies that
// printExpressionStatement falls back to verbatim when the gap between the
// inner expression's end and the statement's end holds a comment.
//
// tailIsCleanTerminator guards against comments in the trailing gap: re-
// minting the semicolon would silently drop any token other than `;` in that
// position. An expression statement like `foo() /* note */;` has a comment
// between `foo()` and `;`, so the printer cannot safely reconstruct the tail
// and must emit the whole statement verbatim instead. Without this guard the
// comment would be lost on the first `ttsc format` pass.
//
//  1. Parse `foo() /* note */;` as an expression statement.
//  2. Dispatch the ExpressionStatement through PrintNode.
//  3. Assert the output preserves the original bytes including the comment,
//     and covered is true (the statement is single-line, so verbatim is safe).
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must preserve foo() /* note */; verbatim and report it covered rather than dropping the expression-tail comment.
// @evidence contracts/testing.md#independent-expectations The exact source literal retains both comment text and semicolon; the single-line subtree can be preserved without frozen continuation columns.
// @evidence contracts/testing.md#distinguishing-cases A comment-bearing statement tail complements ordinary nested-call reflow and nil expression/node boundaries.
// @evidence contracts/testing.md#execution-ownership TestDispatchExpressionStatementReturnsVerbatimForDirtyTail is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchExpressionStatementReturnsVerbatimForDirtyTail(t *testing.T) {
  src := "foo() /* note */;\n"
  file := parseTS(t, src)
  node := firstNodeOfKind(t, file, shimast.KindExpressionStatement)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := PrintNode(ctx, node)
  // Single-line verbatim is reflow-safe: covered must be true.
  if !covered {
    t.Fatalf("single-line verbatim expression statement should be covered=true")
  }
  got := Print(doc, ctx.Opts)
  want := "foo() /* note */;"
  if got != want {
    t.Fatalf("verbatim mismatch: want %q, got %q", want, got)
  }
}
