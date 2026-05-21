package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchCallExplodesWhenHuggedObjectHeaderOverflows verifies the
// hugged-header overflow fallback also fires when the hugged last
// argument is an object literal rather than a callback.
//
// The object-literal and callback hugging paths share printListHugging-
// Last but reach it through different per-node printers, so a
// regression that only fixed the callback case would leave overflowing
// object-argument calls hugging past printWidth. This pins the object
// branch separately.
//
//  1. Parse a call with two leading arguments and a trailing object
//     literal whose opening line overflows printWidth=24.
//  2. Dispatch the CallExpression.
//  3. Assert every argument lands on its own indented line.
func TestDispatchCallExplodesWhenHuggedObjectHeaderOverflows(t *testing.T) {
  file := parseTS(t, "register(alphaArg, betaArg, { key: value });\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 24
  ctx := NewPrintContext(file, opts)
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("call with object-literal argument should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "register(\n  alphaArg,\n  betaArg,\n  { key: value },\n)"
  if got != want {
    t.Fatalf("hugged object-header overflow mismatch:\nwant %q\ngot  %q", want, got)
  }
}
