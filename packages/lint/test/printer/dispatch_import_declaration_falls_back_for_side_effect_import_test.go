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
