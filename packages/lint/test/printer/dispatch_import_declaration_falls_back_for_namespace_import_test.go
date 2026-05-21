package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchImportDeclarationFallsBackForNamespaceImport verifies that
// `import * as ns from "x"` is rendered verbatim.
//
// Namespace imports carry a NamespaceImport node as their NamedBindings,
// whose Kind is KindNamespaceImport — not KindNamedImports. The printer
// detects this and bails to verbatim because there is no reflow surface
// for a single `* as ns` token. Pinning this branch prevents a future
// extension from accidentally routing namespace imports through the
// named-imports list printer and producing malformed output.
//
// 1. Parse `import * as ns from "x";`.
// 2. Dispatch the ImportDeclaration node through printImportDeclaration.
// 3. Assert the output equals the verbatim source bytes of the declaration.
func TestDispatchImportDeclarationFallsBackForNamespaceImport(t *testing.T) {
  src := "import * as ns from \"x\";\n"
  file := parseTS(t, src)
  node := firstNodeOfKind(t, file, shimast.KindImportDeclaration)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printImportDeclaration(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "import * as ns from \"x\";" {
    t.Fatalf("namespace import verbatim mismatch: %q", got)
  }
}
