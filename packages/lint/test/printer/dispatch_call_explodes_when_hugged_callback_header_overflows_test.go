package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchCallExplodesWhenHuggedCallbackHeaderOverflows verifies a
// call whose hugged opening line would overflow printWidth falls back to
// the fully exploded argument list instead of hugging anyway.
//
// Hugging keeps the leading arguments and the callback header on one
// line. When that header itself exceeds printWidth, hugging cannot help
// — the line is already too wide before the body even begins. The
// ConditionalGroup the argument list emits lets the engine reject the
// hugged option and pick the exploded shape, which is what Prettier
// does.
//
//  1. Parse a call with two leading arguments and a block callback whose
//     `process(alphaArgument, betaArgument, () => {` header is 44 wide.
//  2. Dispatch the CallExpression under printWidth=30.
//  3. Assert every argument lands on its own indented line.
func TestDispatchCallExplodesWhenHuggedCallbackHeaderOverflows(t *testing.T) {
  file := parseTS(t, "process(alphaArgument, betaArgument, () => { run(); });\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 30
  ctx := NewPrintContext(file, opts)
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("call with block callback argument should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "process(\n  alphaArgument,\n  betaArgument,\n  () => {\n    run();\n  },\n)"
  if got != want {
    t.Fatalf("hugged-header overflow mismatch:\nwant %q\ngot  %q", want, got)
  }
}
