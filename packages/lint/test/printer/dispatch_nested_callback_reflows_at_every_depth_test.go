package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNestedCallbackReflowsAtEveryDepth verifies a callback
// whose body statement is itself a callback call reflows with
// consistent indentation at every nesting level.
//
// The expression-statement printer is what unblocks this: a callback
// body is built of expression statements, and without a printer for
// them the inner `inner(() => { … });` would print verbatim — frozen
// at its source columns and tainting coverage. With the statement
// printer, the inner call dispatches normally, so each level indents
// two spaces deeper than its parent.
//
//  1. Parse `outer(() => { inner(() => { deep(); }); });`.
//  2. Dispatch the outer CallExpression through PrintNode.
//  3. Assert `covered` is true and every level indents consistently.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must retain the complete outer/inner/deep call nesting with consistently indented callback bodies and report full coverage.
// @evidence contracts/testing.md#independent-expectations The full literal result independently fixes every call, arrow, brace and statement order, excluding only the enclosing final statement terminator.
// @evidence contracts/testing.md#distinguishing-cases Two nested callback levels distinguish recursive statement dispatch from reflow limited to the first callback.
// @evidence contracts/testing.md#execution-ownership TestDispatchNestedCallbackReflowsAtEveryDepth is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchNestedCallbackReflowsAtEveryDepth(t *testing.T) {
  file := parseTS(t, "outer(() => {\n  inner(() => {\n    deep();\n  });\n});\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("nested callback of plain statements should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "outer(() => {\n  inner(() => {\n    deep();\n  });\n})"
  if got != want {
    t.Fatalf("nested callback reflow mismatch:\nwant %q\ngot  %q", want, got)
  }
}
