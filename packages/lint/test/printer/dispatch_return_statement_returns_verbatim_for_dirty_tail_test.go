package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchReturnStatementReturnsVerbatimForDirtyTail verifies that
// printReturnStatement falls back to verbatim when a comment appears between
// the returned expression and the trailing semicolon.
//
// tailIsCleanTerminator rejects any token other than `;` and whitespace in
// the gap between the expression end and the statement end. A comment like
// `return x /* note */;` sits in that gap and would be silently dropped if
// the printer re-minted the semicolon. The verbatim fallback preserves the
// original bytes including the comment. This mirrors the same guard in the
// expression-statement printer.
//
//  1. Parse `function f() { return x /* note */; }`.
//  2. Dispatch the ReturnStatement through PrintNode.
//  3. Assert the output preserves the original bytes and covered is true
//     (the statement is single-line, so verbatim is safe).
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must preserve return x /* note */; exactly and report it covered.
// @evidence contracts/testing.md#independent-expectations The authored source requires x, the comment and semicolon to remain in order; single-line verbatim is reflow-safe.
// @evidence contracts/testing.md#distinguishing-cases A comment-bearing tail complements a clean returned object that can reflow and a bare return with no expression.
// @evidence contracts/testing.md#execution-ownership TestDispatchReturnStatementReturnsVerbatimForDirtyTail is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchReturnStatementReturnsVerbatimForDirtyTail(t *testing.T) {
  file := parseTS(t, "function f() { return x /* note */; }\n")
  node := firstNodeOfKind(t, file, shimast.KindReturnStatement)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := PrintNode(ctx, node)
  // Single-line verbatim is safe: covered must be true.
  if !covered {
    t.Fatalf("single-line verbatim return should be covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  want := "return x /* note */;"
  if got != want {
    t.Fatalf("verbatim mismatch: want %q, got %q", want, got)
  }
}
