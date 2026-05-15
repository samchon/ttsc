package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchArrayLiteralFlatWhenFits verifies short arrays stay on a
// single line with no bracket-internal whitespace.
//
// Array literals diverge from object literals on one detail: there is
// no leading/trailing space inside the brackets in flat mode. This
// case pins that convention; a regression that copy-pasted the object
// printer's `Space: true` would produce `[ a, b, c ]`.
//
//  1. Parse `const x = [1, 2, 3];`.
//  2. Render under default options.
//  3. Assert the array printed flat as `[1, 2, 3]`.
func TestDispatchArrayLiteralFlatWhenFits(t *testing.T) {
  file := parseTS(t, "const x = [1, 2, 3];\n")
  node := firstNodeOfKind(t, file, shimast.KindArrayLiteralExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  got := Print(printArrayLiteral(ctx, node), ctx.Opts)
  if got != "[1, 2, 3]" {
    t.Fatalf("flat array mismatch: %q", got)
  }
}
