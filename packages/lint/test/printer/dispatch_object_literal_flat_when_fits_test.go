package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchObjectLiteralFlatWhenFits verifies the object-literal
// per-node printer keeps short objects on a single line.
//
// `{ a: 1 }` is well under any reasonable printWidth, so reflow must
// produce the same bytes (modulo bracket-spacing whitespace). The case
// pins the "fit" branch end-to-end: parse → dispatch → render →
// compare to the canonical flat form.
//
//  1. Parse a one-statement source containing a small object literal.
//  2. Walk the file to grab the literal's Node.
//  3. Print under default options and assert `{ a: 1 }`.
func TestDispatchObjectLiteralFlatWhenFits(t *testing.T) {
  file := parseTS(t, "const x = { a: 1 };\n")
  node := firstNodeOfKind(t, file, shimast.KindObjectLiteralExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  got := Print(printObjectLiteral(ctx, node), ctx.Opts)
  if got != "{ a: 1 }" {
    t.Fatalf("flat object mismatch: %q", got)
  }
}
