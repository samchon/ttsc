package linthost

import (
  "testing"
)

// TestDispatchParenthesizedExpressionReturnsCoveredForNilNode verifies that
// printParenthesizedExpression returns an empty Doc and covered==true when
// called with a nil node.
//
// The nil guard is defensive: PrintNode screens nil before dispatching, so it
// is reachable only through a direct call. Returning covered==true is correct
// because an empty Doc contributes no multi-line verbatim content to the
// surrounding Doc tree.
//
//  1. Build a PrintContext from any valid parsed file.
//  2. Call printParenthesizedExpression(ctx, nil) directly.
//  3. Assert the returned Doc is empty and covered is true.
//
// @evidence contracts/testing.md#behavioral-verification printParenthesizedExpression must return empty, covered output for nil.
// @evidence contracts/testing.md#independent-expectations An absent subtree contains neither expression bytes nor unsupported multiline content.
// @evidence contracts/testing.md#distinguishing-cases Nil parenthesized node complements an intact inner object and a public factory node with no expression.
// @evidence contracts/testing.md#execution-ownership TestDispatchParenthesizedExpressionReturnsCoveredForNilNode is a plain top-level Go unit test, selectable with go test -run, that calls printParenthesizedExpression directly on a nil node with a PrintContext built from a trivial parsed file inside the test process; it installs no consumer, builds no native artifact and starts no product host.
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
