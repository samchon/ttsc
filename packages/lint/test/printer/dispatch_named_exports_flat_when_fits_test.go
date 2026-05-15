package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNamedExportsFlatWhenFits verifies the named-exports
// per-node printer keeps short `export { a, b };` clauses flat.
//
// NamedExports shares listShape with NamedImports, but a regression
// in the dispatcher's NamedExports branch — e.g. mis-routing to a
// different list helper — would only surface here, because the
// surrounding ExportDeclaration is not modeled by the rule's
// printer set.
//
//  1. Parse `export { a, b };`.
//  2. Dispatch the NamedExports node directly.
//  3. Assert the result is `{ a, b }`.
func TestDispatchNamedExportsFlatWhenFits(t *testing.T) {
  file := parseTS(t, "export { a, b };\n")
  node := firstNodeOfKind(t, file, shimast.KindNamedExports)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  got := Print(printNamedExports(ctx, node), ctx.Opts)
  if got != "{ a, b }" {
    t.Fatalf("flat named exports mismatch: %q", got)
  }
}
