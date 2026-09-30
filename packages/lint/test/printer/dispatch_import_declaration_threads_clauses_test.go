package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchImportDeclarationThreadsClauses verifies the
// ImportDeclaration printer correctly assembles `import { … } from
// "spec";` around the named-imports clause.
//
// The printer's job here is gluing the keyword + clause + `from` +
// module specifier together while delegating the bracket reflow to
// the NamedImports printer. A regression in the glue would either drop
// the semicolon, eat the `from` keyword, or quote the specifier
// incorrectly.
//
//  1. Parse `import { a } from "x";`.
//  2. Render the ImportDeclaration node directly.
//  3. Assert the result round-trips to `import { a } from "x";`.
//
// @evidence contracts/testing.md#behavioral-verification printImportDeclaration must preserve import { a } from x including keywords, module string and semicolon.
// @evidence contracts/testing.md#independent-expectations The full literal declaration is independently authored; exact comparison catches lost or reordered clause tokens.
// @evidence contracts/testing.md#distinguishing-cases The ordinary value-named clause complements type-only and absent-terminator variants plus fallback import kinds.
// @evidence contracts/testing.md#execution-ownership TestDispatchImportDeclarationThreadsClauses is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchImportDeclarationThreadsClauses(t *testing.T) {
  file := parseTS(t, "import { a } from \"x\";\n")
  node := firstNodeOfKind(t, file, shimast.KindImportDeclaration)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printImportDeclaration(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "import { a } from \"x\";" {
    t.Fatalf("import declaration mismatch: %q", got)
  }
}
