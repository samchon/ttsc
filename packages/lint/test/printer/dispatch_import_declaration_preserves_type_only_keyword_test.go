package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchImportDeclarationPreservesTypeOnlyKeyword verifies
// `import type { … } from "x";` keeps its `type` modifier on reflow.
//
// The printer composes `import type ` based on the clause's
// PhaseModifier kind. If that branch regressed, every `import type`
// in a project would silently lose the modifier on the first
// `ttsc format` pass, deleting an erasable-import guarantee.
//
//  1. Parse `import type { A } from "x";`.
//  2. Render under default options.
//  3. Assert the keyword survives in the output.
//
// @evidence contracts/testing.md#behavioral-verification printImportDeclaration must retain type in import type { A } from x.
// @evidence contracts/testing.md#independent-expectations The authored type-only fixture specifies a compile-time binding; losing type would change the import category.
// @evidence contracts/testing.md#distinguishing-cases Type-only clause contrasts with the ordinary value import and imports without named bindings.
// @evidence contracts/testing.md#execution-ownership TestDispatchImportDeclarationPreservesTypeOnlyKeyword is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
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
