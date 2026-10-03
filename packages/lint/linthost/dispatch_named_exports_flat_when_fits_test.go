package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNamedExportsFlatWhenFits verifies the named-exports
// per-node printer keeps short `export { a, b };` clauses flat.
//
// NamedExports shares listShape with NamedImports. This test calls its
// printer directly and checks the complete fitting clause; it does not
// exercise PrintNode routing or the surrounding ExportDeclaration.
//
//  1. Parse `export { a, b };`.
//  2. Call printNamedExports directly on the clause node.
//  3. Assert the result is `{ a, b }`.
//
// @evidence contracts/testing.md#behavioral-verification printNamedExports must keep { a, b } flat with spaces inside its braces.
// @evidence contracts/testing.md#independent-expectations The literal clause follows the documented named-list flat spacing while retaining binding order.
// @evidence contracts/testing.md#distinguishing-cases The fitting two-entry clause complements overflowing named exports and malformed Elements fallback.
// @evidence contracts/testing.md#execution-ownership TestDispatchNamedExportsFlatWhenFits is a plain top-level Go unit test, selectable with go test -run, that calls printNamedExports directly on a parsed two-specifier export clause at the default width inside the test process; it installs no consumer, builds no native artifact and starts no product host.
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
