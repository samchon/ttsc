package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchReturnStatementReturnsVerbatimForBareReturn verifies that
// printReturnStatement falls back to verbatim for a bare `return;` statement
// that carries no expression.
//
// A bare `return;` has `stmt.Expression == nil`. The printer cannot dispatch
// a nil expression through PrintNode, and there is nothing to reflow: the
// statement is a single keyword. The verbatim fallback emits the original
// source bytes unchanged. This branch must be taken to prevent a nil
// dereference when the return-statement printer tries to read the expression
// end position.
//
//  1. Parse a function with a bare `return;` statement.
//  2. Dispatch the ReturnStatement through PrintNode.
//  3. Assert the output is `return;` verbatim and covered is true
//     (the statement is single-line).
func TestDispatchReturnStatementReturnsVerbatimForBareReturn(t *testing.T) {
  file := parseTS(t, "function f() { return; }\n")
  node := firstNodeOfKind(t, file, shimast.KindReturnStatement)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("single-line bare return should be covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "return;" {
    t.Fatalf("bare return mismatch: want %q, got %q", "return;", got)
  }
}
