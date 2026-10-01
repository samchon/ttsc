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
//
// @evidence contracts/testing.md#behavioral-verification printNewExpression must return a no-op Doc for an absent constructor node.
// @evidence contracts/testing.md#independent-expectations No input node means no output expression; zero Doc is the layout-algebra identity.
// @evidence contracts/testing.md#distinguishing-cases Nil-node safety complements valid constructors and public malformed argument lists.
// @evidence contracts/testing.md#execution-ownership TestPrintNewExpressionReturnsEmptyForNilNode is one Go unit entry that parses a trivial source for a PrintContext and calls the unexported printNewExpression with a nil node in-process; it installs, builds and launches nothing.
func TestPrintNewExpressionReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "new Foo();\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  got, _ := printNewExpression(ctx, nil)
  if got.Kind != 0 {
    t.Fatalf("expected empty Doc for nil node, got Doc.Kind=%d", got.Kind)
  }
}
