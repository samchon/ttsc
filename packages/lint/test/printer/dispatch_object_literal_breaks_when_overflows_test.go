package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchObjectLiteralBreaksWhenOverflows verifies an object whose
// flat projection exceeds the column budget renders broken across
// lines with a trailing comma and proper indentation.
//
// The case pins the headline reflow behavior: the same input flips
// from flat to broken purely based on `printWidth`. A regression that
// failed to inject the trailing comma in broken mode (Prettier's
// `trailingComma: "all"` default) would fail this assertion.
//
//  1. Parse a source whose object literal has three two-letter keys
//     mapping to short values — flat width ~30 chars.
//  2. Print under printWidth=20 to force the break.
//  3. Assert the result has the three properties indented two spaces
//     each, each terminated by a comma (including the last).
//
// @evidence contracts/testing.md#behavioral-verification printObjectLiteral must break aa:1, bb:2 and cc:3 at width twenty without changing values or property order.
// @evidence contracts/testing.md#independent-expectations The full literal expected object follows the documented broken braces, two-space indentation and comma policy.
// @evidence contracts/testing.md#distinguishing-cases An overflowing three-property object complements the fitting singleton object and malformed public Properties lists.
// @evidence contracts/testing.md#execution-ownership TestDispatchObjectLiteralBreaksWhenOverflows is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchObjectLiteralBreaksWhenOverflows(t *testing.T) {
  file := parseTS(t, "const x = { aa: 1, bb: 2, cc: 3 };\n")
  node := firstNodeOfKind(t, file, shimast.KindObjectLiteralExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  doc, _ := printObjectLiteral(ctx, node)
  got := Print(doc, ctx.Opts)
  want := "{\n  aa: 1,\n  bb: 2,\n  cc: 3,\n}"
  if got != want {
    t.Fatalf("broken object mismatch:\nwant %q\ngot  %q", want, got)
  }
}
