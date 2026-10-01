package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// Verifies a default-only import preserves its source.
//
// A default-only ImportClause has no named bindings list for the list printer. Its fallback must retain the default name and module instead of truncating the declaration. This fixture does not exercise default-plus-named clause reflow.
//
// 1. Parse import Default from x with its quoted module.
// 2. Call printImportDeclaration directly.
// 3. Assert the entire declaration remains verbatim.
//
// @evidence contracts/testing.md#behavioral-verification printImportDeclaration must preserve the complete default-only import from x rather than losing Default or the module specifier.
// @evidence contracts/testing.md#independent-expectations The source literal is the independent verbatim oracle; this default-only clause has no named-bindings list to reflow.
// @evidence contracts/testing.md#distinguishing-cases A default-only import complements ordinary named bindings, namespace imports and side-effect-only imports.
// @evidence contracts/testing.md#execution-ownership TestDispatchImportDeclarationFallsBackForDefaultImport is a plain top-level Go unit test, selectable with go test -run, that calls printImportDeclaration directly on a parsed default-only import inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchImportDeclarationFallsBackForDefaultImport(t *testing.T) {
  src := "import Default from \"x\";\n"
  file := parseTS(t, src)
  node := firstNodeOfKind(t, file, shimast.KindImportDeclaration)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printImportDeclaration(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "import Default from \"x\";" {
    t.Fatalf("default import verbatim mismatch: %q", got)
  }
}
