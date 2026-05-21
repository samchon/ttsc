package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchCallKeepsHuggedObjectFlatWhenItFits verifies a call with a
// hugged object-literal argument stays on one line when the whole call
// fits the printWidth budget.
//
// The argument list's first ConditionalGroup option is the all-flat
// shape. This pins that the engine prefers it — a short object call is
// not needlessly exploded just because the hugged option exists.
//
//  1. Parse `save({ id: value });` — flat width 19.
//  2. Dispatch the CallExpression under printWidth=30.
//  3. Assert the call renders on a single line.
func TestDispatchCallKeepsHuggedObjectFlatWhenItFits(t *testing.T) {
  file := parseTS(t, "save({ id: value });\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 30
  ctx := NewPrintContext(file, opts)
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("object-argument call should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "save({ id: value })"
  if got != want {
    t.Fatalf("flat hugged object mismatch:\nwant %q\ngot  %q", want, got)
  }
}
