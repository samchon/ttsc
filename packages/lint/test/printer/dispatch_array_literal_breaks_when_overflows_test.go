package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchArrayLiteralBreaksWhenOverflows verifies a long array
// reflows across lines under a tight `printWidth`.
//
// The symmetric partner of the object-broken case. Both literals
// share the same printList machinery, so this test would catch a
// shape-class divergence (e.g. forgetting trailing commas only on
// arrays).
//
//  1. Parse a source with a six-element array of long strings.
//  2. Print under printWidth=20 to force a break.
//  3. Assert each element is on its own indented line with a trailing
//     comma after the last.
func TestDispatchArrayLiteralBreaksWhenOverflows(t *testing.T) {
  file := parseTS(t, "const x = [\"alpha\", \"beta\", \"gamma\"];\n")
  node := firstNodeOfKind(t, file, shimast.KindArrayLiteralExpression)
  opts := DefaultPrintOptions()
  opts.PrintWidth = 20
  ctx := NewPrintContext(file, opts)
  got := Print(printArrayLiteral(ctx, node), ctx.Opts)
  want := "[\n  \"alpha\",\n  \"beta\",\n  \"gamma\",\n]"
  if got != want {
    t.Fatalf("broken array mismatch:\nwant %q\ngot  %q", want, got)
  }
}
