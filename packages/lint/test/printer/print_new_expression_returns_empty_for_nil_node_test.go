package linthost

import (
  "testing"
)

// TestPrintNewExpressionReturnsEmptyForNilNode verifies that
// printNewExpression returns an empty Doc when given a nil node.
//
// The nil guard at the top of printNewExpression mirrors the one in
// printCallExpression. Without it, the AsNewExpression() type assertion
// on a nil *Node would panic before reaching any other check.
//
// 1. Call printNewExpression with a nil node.
// 2. Assert the returned Doc is the zero value (Kind == 0).
func TestPrintNewExpressionReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "new Foo();\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  got, _ := printNewExpression(ctx, nil)
  if got.Kind != 0 {
    t.Fatalf("expected empty Doc for nil node, got Doc.Kind=%d", got.Kind)
  }
}
