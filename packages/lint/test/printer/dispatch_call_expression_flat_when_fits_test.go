package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchCallExpressionFlatWhenFits verifies a short call
// expression renders on one line.
//
// Call expressions are the most common reflow target after object
// literals, so the per-node printer must stitch the callee verbatim
// onto the argument list shape without dropping or duplicating
// anything. The case pins the simplest flat shape: `foo(a, b)`.
//
//  1. Parse `foo(a, b);`.
//  2. Dispatch and print under default options.
//  3. Assert the result is `foo(a, b)`.
//
// @evidence contracts/testing.md#behavioral-verification printCallExpression must keep foo(a, b) flat at the default width.
// @evidence contracts/testing.md#independent-expectations The full literal expression preserves its callee and ordered arguments and fits the documented width budget.
// @evidence contracts/testing.md#distinguishing-cases An intact short call complements over-wide calls and malformed public argument lists.
// @evidence contracts/testing.md#execution-ownership TestDispatchCallExpressionFlatWhenFits is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchCallExpressionFlatWhenFits(t *testing.T) {
  file := parseTS(t, "foo(a, b);\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printCallExpression(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "foo(a, b)" {
    t.Fatalf("flat call mismatch: %q", got)
  }
}
