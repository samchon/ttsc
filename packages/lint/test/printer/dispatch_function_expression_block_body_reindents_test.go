package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchFunctionExpressionBlockBodyReindents verifies the
// function-expression printer re-indents a block body the same way the
// arrow-function printer does.
//
// Function expressions reach printBlock through the shared
// printFunctionLike path. The case exists separately from the arrow
// case so a regression that only wired the arrow branch — leaving
// `function () { … }` on the verbatim fallback — would not silently
// pass. The verbatim fallback would freeze the body columns and corrupt
// any enclosing reflow.
//
//  1. Parse `const run = function () { step(); };`.
//  2. Dispatch the FunctionExpression through PrintNode.
//  3. Assert the body statement indents two spaces under the signature
//     and the closing brace returns to column 0.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must expand function () { step(); } into an indented block and report it fully covered.
// @evidence contracts/testing.md#independent-expectations The literal expected function retains the signature and step() statement, changing only body layout.
// @evidence contracts/testing.md#distinguishing-cases A parsed valid body complements nil-node/nil-body factory safety and multiline-signature abstention.
// @evidence contracts/testing.md#execution-ownership TestDispatchFunctionExpressionBlockBodyReindents is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchFunctionExpressionBlockBodyReindents(t *testing.T) {
  file := parseTS(t, "const run = function () { step(); };\n")
  node := firstNodeOfKind(t, file, shimast.KindFunctionExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("function expression with plain block body should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "function () {\n  step();\n}"
  if got != want {
    t.Fatalf("function expression body mismatch:\nwant %q\ngot  %q", want, got)
  }
}
