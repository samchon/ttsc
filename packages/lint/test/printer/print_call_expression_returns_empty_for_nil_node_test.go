package linthost

import (
  "testing"
)

// TestPrintCallExpressionReturnsEmptyForNilNode verifies that
// printCallExpression returns an empty Doc when given a nil node.
//
// The nil guard at the top of printCallExpression (before the
// AsCallExpression type assertion) prevents a nil-dereference panic
// when a caller passes a nil AST node. Without that guard the type
// assertion on n.data would panic before any other check could run.
//
// 1. Call printCallExpression with a nil node.
// 2. Assert the returned Doc is the zero value (Kind == 0).
func TestPrintCallExpressionReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "foo(a);\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  got, _ := printCallExpression(ctx, nil)
  if got.Kind != 0 {
    t.Fatalf("expected empty Doc for nil node, got Doc.Kind=%d", got.Kind)
  }
}
