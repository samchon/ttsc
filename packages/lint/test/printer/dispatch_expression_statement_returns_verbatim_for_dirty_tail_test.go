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
