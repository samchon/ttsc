package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchImportDeclarationFallsBackForDefaultImport verifies that
// `import Default from "x"` is rendered verbatim.
//
// Default imports set the ImportClause's Name field to a non-nil identifier.
// The printer checks `clause.Name() != nil` and falls back to verbatim so
// `import Default, { a } from "x"` shapes (which mix default + named) are
// never silently truncated to just the named part. Covering this branch
// validates that the printer's v1 scope boundary is stable.
//
// 1. Parse `import Default from "x";`.
// 2. Dispatch the ImportDeclaration node through printImportDeclaration.
// 3. Assert the output equals the verbatim source bytes of the declaration.
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
