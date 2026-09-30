package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification printNamedExports must keep { a, b } flat with spaces inside its braces.
// @evidence contracts/testing.md#independent-expectations The literal clause follows the documented named-list flat spacing while retaining binding order.
// @evidence contracts/testing.md#distinguishing-cases The fitting two-entry clause complements overflowing named exports and malformed Elements fallback.
// @evidence contracts/testing.md#execution-ownership TestDispatchNamedExportsFlatWhenFits is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchNamedExportsFlatWhenFits(t *testing.T) {
  file := parseTS(t, "export { a, b };\n")
  node := firstNodeOfKind(t, file, shimast.KindNamedExports)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printNamedExports(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "{ a, b }" {
    t.Fatalf("flat named exports mismatch: %q", got)
  }
}
