package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchCallBreaksHuggedObjectWhenFlatFormOverflows verifies a
// call whose hugged final argument is an object literal breaks that
// object across lines when the whole call cannot fit on one line.
//
// A hugged object renders flat whenever its own group fits, which left
// `foo({ a, b })` on a single line even when that line — parens, the
// object and any trailing `;` — overflowed printWidth. The argument
// list now offers an all-flat option and a hugged option whose object
// is forced broken; the engine picks the hugged-broken shape when the
// all-flat one does not fit.
//
//  1. Parse `save({ alpha: first, beta: second });` — flat width 36.
//  2. Dispatch the CallExpression under printWidth=30.
//  3. Assert the object literal breaks one member per line.
func TestDispatchCallBreaksHuggedObjectWhenFlatFormOverflows(t *testing.T) {
  file := parseTS(t, "save({ alpha: first, beta: second });\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 30
  ctx := NewPrintContext(file, opts)
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("object-argument call should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "save({\n  alpha: first,\n  beta: second,\n})"
  if got != want {
    t.Fatalf("hugged object overflow mismatch:\nwant %q\ngot  %q", want, got)
  }
}
