package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchImportDeclarationPreservesTypeOnlyKeyword verifies
// `import type { … } from "x";` keeps its `type` modifier on reflow.
//
// The printer composes `import type ` when the clause reports IsTypeOnly.
// The exact output must retain that modifier along with the binding,
// module and terminator. This test does not run a format command or
// exercise every type-only import shape.
//
//  1. Parse `import type { A } from "x";`.
//  2. Render under default options.
//  3. Assert the keyword survives in the output.
//
// @evidence contracts/testing.md#behavioral-verification printImportDeclaration must retain type in import type { A } from x.
// @evidence contracts/testing.md#independent-expectations The authored type-only fixture specifies a compile-time binding; losing type would change the import category.
// @evidence contracts/testing.md#distinguishing-cases Type-only clause contrasts with the ordinary value import and imports without named bindings.
// @evidence contracts/testing.md#execution-ownership TestDispatchImportDeclarationPreservesTypeOnlyKeyword is a plain top-level Go unit test, selectable with go test -run, that calls printImportDeclaration directly on a parsed type-only named import inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchImportDeclarationPreservesTypeOnlyKeyword(t *testing.T) {
  file := parseTS(t, "import type { A } from \"x\";\n")
  node := firstNodeOfKind(t, file, shimast.KindImportDeclaration)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printImportDeclaration(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "import type { A } from \"x\";" {
    t.Fatalf("type-only import mismatch: %q", got)
  }
}
