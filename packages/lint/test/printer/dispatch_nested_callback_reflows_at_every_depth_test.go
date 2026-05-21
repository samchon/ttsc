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
