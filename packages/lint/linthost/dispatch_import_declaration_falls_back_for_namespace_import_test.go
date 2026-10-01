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
// @evidence contracts/testing.md#execution-ownership TestDispatchImportDeclarationFallsBackForNamespaceImport is a plain top-level Go unit test, selectable with go test -run, that calls printImportDeclaration directly on a parsed namespace import inside the test process; it installs no consumer, builds no native artifact and starts no product host.
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
