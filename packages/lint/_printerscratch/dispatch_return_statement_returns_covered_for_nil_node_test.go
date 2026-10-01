package linthost

import (
  "testing"
)

// TestDispatchReturnStatementReturnsCoveredForNilNode verifies that
// printReturnStatement returns an empty Doc and covered==true when called
// with a nil node.
//
// The nil guard in printReturnStatement mirrors those in the arrow-function
// and expression-statement printers: a nil node must not panic. covered==true
// is returned because an empty Doc contributes no multi-line content to the
// enclosing Doc tree. A regression that returned covered==false would
// incorrectly taint a block's coverage flag through a nil statement
// placeholder during error-recovery parsing.
//
//  1. Build a PrintContext from any valid parsed file.
//  2. Call printReturnStatement(ctx, nil) directly.
//  3. Assert the returned Doc is empty and covered is true.
//
// @evidence contracts/testing.md#behavioral-verification printReturnStatement must return empty output and covered true for an absent node.
// @evidence contracts/testing.md#independent-expectations The missing-statement identity has no return token or unsafe source range.
// @evidence contracts/testing.md#distinguishing-cases Nil return node complements parsed bare return, comment-bearing return and returned-object reflow.
// @evidence contracts/testing.md#execution-ownership TestDispatchReturnStatementReturnsCoveredForNilNode is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchReturnStatementReturnsCoveredForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := printReturnStatement(ctx, nil)
  if !covered {
    t.Fatalf("printReturnStatement(nil) should return covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("printReturnStatement(nil) should produce empty output, got %q", got)
  }
}
