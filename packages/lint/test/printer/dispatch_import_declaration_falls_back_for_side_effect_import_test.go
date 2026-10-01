package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchImportDeclarationFallsBackForSideEffectImport verifies that
// a bare `import "x"` (no import clause) is rendered verbatim.
//
// Side-effect imports have no ImportClause at all (`imp.ImportClause == nil`).
// The printer falls back to verbatim so no bytes are lost, matching the
// "safety net" contract described in print_dispatch.go. Without this case
// the clause-nil branch would remain uncovered and a future guard removal
// could silently drop side-effect imports.
//
// 1. Parse `import "x";`.
// 2. Dispatch the ImportDeclaration node through printImportDeclaration.
// 3. Assert the output equals the verbatim source bytes of the declaration.
//
// @evidence contracts/testing.md#behavioral-verification printImportDeclaration must preserve import x with its quoted module and semicolon when no clause exists.
// @evidence contracts/testing.md#independent-expectations The exact side-effect-only source specifies a module evaluation import without inventing bindings.
// @evidence contracts/testing.md#distinguishing-cases Absent ImportClause differs from default, namespace and named clauses.
// @evidence contracts/testing.md#execution-ownership TestDispatchImportDeclarationFallsBackForSideEffectImport is a plain top-level Go unit test, selectable with go test -run, that calls printImportDeclaration directly on a parsed side-effect import inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchImportDeclarationFallsBackForSideEffectImport(t *testing.T) {
  src := "import \"x\";\n"
  file := parseTS(t, src)
  node := firstNodeOfKind(t, file, shimast.KindImportDeclaration)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printImportDeclaration(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "import \"x\";" {
    t.Fatalf("side-effect import verbatim mismatch: %q", got)
  }
}
