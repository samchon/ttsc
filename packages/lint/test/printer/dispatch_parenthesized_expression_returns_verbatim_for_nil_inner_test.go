package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchParenthesizedExpressionReturnsVerbatimForNilInner verifies that
// printParenthesizedExpression falls back to verbatim when the parenthesized-
// expression node has a nil inner expression.
//
// The guard `paren == nil || paren.Expression == nil` catches a synthetic or
// error-recovered parenthesized-expression node with no inner expression. In
// that case the printer emits the source bytes verbatim rather than trying to
// dispatch a nil expression through PrintNode. The test constructs such a node
// via the node factory — passing nil as the expression argument — which is the
// only path to this guard without a parser-produced node.
//
//  1. Create a synthetic ParenthesizedExpression node with Expression=nil.
//  2. Build a PrintContext from a real parsed file so ctx.Source is valid.
//  3. Call printParenthesizedExpression(ctx, syntheticNode) directly.
//  4. Assert the output is empty and covered is true (zero-range verbatim).
//
// @evidence contracts/testing.md#behavioral-verification printParenthesizedExpression must safely return empty, covered output for a factory parenthesized node whose Expression is nil.
// @evidence contracts/testing.md#independent-expectations The public factory provides no source range, so fallback cannot invent parentheses or inner text.
// @evidence contracts/testing.md#distinguishing-cases Missing inner expression differs from missing node and the valid parenthesized-object reflow.
// @evidence contracts/testing.md#execution-ownership TestDispatchParenthesizedExpressionReturnsVerbatimForNilInner is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchParenthesizedExpressionReturnsVerbatimForNilInner(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())

  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  syntheticNode := factory.NewParenthesizedExpression(nil)

  doc, covered := printParenthesizedExpression(ctx, syntheticNode)
  if !covered {
    t.Fatalf("nil-inner paren should be covered=true (empty verbatim), got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-inner paren should produce empty output, got %q", got)
  }
}
