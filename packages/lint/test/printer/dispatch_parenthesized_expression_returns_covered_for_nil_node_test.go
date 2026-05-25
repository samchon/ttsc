package linthost

import (
  "testing"
)

// TestDispatchParenthesizedExpressionReturnsCoveredForNilNode verifies that
// printParenthesizedExpression returns an empty Doc and covered==true when
// called with a nil node.
//
// The nil guard protects against panics when AST nodes are missing during
// error-recovery parse passes. Returning covered==true for a nil node is
// correct because an empty Doc contributes no multi-line verbatim content to
// the surrounding Doc tree. A regression that returned covered==false would
// cause the formatPrintWidth rule to abstain unnecessarily on every
// parenthesized expression that follows the nil path.
//
//  1. Build a PrintContext from any valid parsed file.
//  2. Call printParenthesizedExpression(ctx, nil) directly.
//  3. Assert the returned Doc is empty and covered is true.
func TestDispatchParenthesizedExpressionReturnsCoveredForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := printParenthesizedExpression(ctx, nil)
  if !covered {
    t.Fatalf("printParenthesizedExpression(nil) should return covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("printParenthesizedExpression(nil) should produce empty output, got %q", got)
  }
}
