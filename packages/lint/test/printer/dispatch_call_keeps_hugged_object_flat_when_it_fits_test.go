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
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must keep save({ id: value }) flat at width thirty and report it covered.
// @evidence contracts/testing.md#independent-expectations The literal object call fits the budget and preserves its key/value pair, braces and parentheses.
// @evidence contracts/testing.md#distinguishing-cases The fitting hugged object complements the same layout family whose members or leading header overflow.
// @evidence contracts/testing.md#execution-ownership TestDispatchCallKeepsHuggedObjectFlatWhenItFits is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
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
