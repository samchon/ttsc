package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification printObjectLiteral must keep { a: 1 } flat with its key and numeric value intact.
// @evidence contracts/testing.md#independent-expectations The independent singleton literal fits the default width and requires supported brace spacing.
// @evidence contracts/testing.md#distinguishing-cases A fitting singleton complements the overflowing three-property object and absent-node boundary.
// @evidence contracts/testing.md#execution-ownership TestDispatchObjectLiteralFlatWhenFits is a plain top-level Go unit test, selectable with go test -run, that calls printObjectLiteral directly on a parsed one-property object literal at the default width inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchObjectLiteralFlatWhenFits(t *testing.T) {
  file := parseTS(t, "const x = { a: 1 };\n")
  node := firstNodeOfKind(t, file, shimast.KindObjectLiteralExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printObjectLiteral(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "{ a: 1 }" {
    t.Fatalf("flat object mismatch: %q", got)
  }
}
