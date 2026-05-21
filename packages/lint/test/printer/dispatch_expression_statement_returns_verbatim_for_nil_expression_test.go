package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchExpressionStatementReturnsVerbatimForNilExpression verifies
// that printExpressionStatement falls back to verbatim when the expression-
// statement node has a nil Expression field.
//
// The guard `stmt == nil || stmt.Expression == nil` protects the printer from
// calling PrintNode on a nil expression. A synthetic ExpressionStatement
// built without an inner expression hits this guard; the printer emits the
// source bytes verbatim. This path is reachable during error-recovery parsing
// where a statement is created before its expression is attached.
//
//  1. Create a synthetic ExpressionStatement with Expression=nil via factory.
//  2. Build a PrintContext from a real parsed file so ctx.Source is valid.
//  3. Call printExpressionStatement(ctx, syntheticNode) directly.
//  4. Assert the output is empty and covered is true.
func TestDispatchExpressionStatementReturnsVerbatimForNilExpression(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())

  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  syntheticNode := factory.NewExpressionStatement(nil)

  doc, covered := printExpressionStatement(ctx, syntheticNode)
  if !covered {
    t.Fatalf("nil-expression stmt should be covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-expression stmt should produce empty output, got %q", got)
  }
}
