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
//
// @evidence contracts/testing.md#behavioral-verification printImportDeclaration must preserve import * as ns from x verbatim.
// @evidence contracts/testing.md#independent-expectations The authored namespace source fixes the wildcard, alias and module rather than treating them as named-list items.
// @evidence contracts/testing.md#distinguishing-cases Namespace binding kind contrasts with the ordinary named-import reflow target and default-only import.
// @evidence contracts/testing.md#execution-ownership TestDispatchImportDeclarationFallsBackForNamespaceImport is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
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
