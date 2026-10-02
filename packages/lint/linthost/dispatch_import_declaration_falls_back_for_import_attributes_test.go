package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchImportDeclarationFallsBackForImportAttributes verifies
// import attributes survive the declaration fallback.
//
// An attributes clause carries module-loading semantics beyond the named binding list. The printer must retain it verbatim rather than constructing a declaration that silently drops the assertion.
//
//  1. Parse the named import with assert { type: json } and its quoted values.
//  2. Call printImportDeclaration directly.
//  3. Assert binding, module and attributes remain exactly as written.
//
// @evidence contracts/testing.md#behavioral-verification printImportDeclaration must preserve import attributes and its named binding verbatim.
// @evidence contracts/testing.md#independent-expectations The exact assert { type: json } source literal fixes the attribute spelling, quoted value and module, preventing silent attribute loss.
// @evidence contracts/testing.md#distinguishing-cases An attributes clause complements an ordinary named import that can be reconstructed without that extra syntax.
// @evidence contracts/testing.md#execution-ownership TestDispatchImportDeclarationFallsBackForImportAttributes is a plain top-level Go unit test, selectable with go test -run, that calls printImportDeclaration directly on a parsed named import with an assert attributes clause inside the test process; it installs no consumer, builds no native artifact and starts no product host.
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
