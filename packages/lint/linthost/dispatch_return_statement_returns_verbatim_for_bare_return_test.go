package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchReturnStatementReturnsVerbatimForBareReturn verifies that
// printReturnStatement falls back to verbatim for a bare `return;` statement
// that carries no expression.
//
// A bare `return;` has `stmt.Expression == nil`. There is no expression
// to lay out, and the return keyword must be retained: the
// statement is a single keyword. The verbatim fallback emits the original
// source bytes unchanged. This branch must be taken to prevent a nil
// dereference when the return-statement printer tries to read the expression
// end position.
//
//  1. Parse a function with a bare `return;` statement.
//  2. Dispatch the ReturnStatement through PrintNode.
//  3. Assert the output is `return;` verbatim and covered is true
//     (the statement is single-line).
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must preserve return; without inventing an expression and report it covered.
// @evidence contracts/testing.md#independent-expectations The independently authored bare-return literal fixes the return keyword and terminator, and is single-line.
// @evidence contracts/testing.md#distinguishing-cases Absent return expression complements an actual returned object and a dirty expression tail.
// @evidence contracts/testing.md#execution-ownership TestDispatchReturnStatementReturnsVerbatimForBareReturn is one Go unit entry that parses function f with a bare return in-process with the TypeScript-Go parser, dispatches the ReturnStatement through PrintNode and renders it with Print; it installs, builds and launches nothing.
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
