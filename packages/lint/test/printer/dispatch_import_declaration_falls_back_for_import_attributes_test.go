package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchImportDeclarationFallsBackForImportAttributes verifies that
// an import declaration with an `assert` / `with` attributes clause is
// rendered verbatim.
//
// Import attributes (`with { type: "json" }`) live after the module
// specifier in `imp.Attributes`. The printer falls back to verbatim so
// those attributes are never silently dropped. This test covers the
// `imp.Attributes != nil` guard at the end of printImportDeclaration,
// which runs after the named-imports clause has already been assembled —
// ensuring the guard fires even when everything else looks valid.
//
// 1. Parse `import { a } from "x" assert { type: "json" };`.
// 2. Dispatch the ImportDeclaration node through printImportDeclaration.
// 3. Assert the output equals the verbatim source bytes of the declaration.
func TestDispatchImportDeclarationFallsBackForImportAttributes(t *testing.T) {
  src := "import { a } from \"x\" assert { type: \"json\" };\n"
  file := parseTS(t, src)
  node := firstNodeOfKind(t, file, shimast.KindImportDeclaration)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printImportDeclaration(ctx, node)
  got := Print(doc, ctx.Opts)
  want := "import { a } from \"x\" assert { type: \"json\" };"
  if got != want {
    t.Fatalf("import-attributes verbatim mismatch:\nwant %q\ngot  %q", want, got)
  }
}
