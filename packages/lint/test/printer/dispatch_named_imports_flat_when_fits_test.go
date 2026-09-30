package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNamedImportsFlatWhenFits verifies short `{ a, b }`
// import clauses keep one line.
//
// The named-imports printer shares listShape with object literals, so
// flat behavior is mostly inherited; this case still pins the
// expectation explicitly because the surrounding ImportDeclaration
// printer threads `import ` and `from "x"` around the clause and a
// regression there could only surface at this exact join.
//
//  1. Parse `import { a, b } from "x";`.
//  2. Render the NamedImports node directly under default options.
//  3. Assert `{ a, b }`.
//
// @evidence contracts/testing.md#behavioral-verification printNamedImports must retain { a, b } on one line with the supported brace spacing.
// @evidence contracts/testing.md#independent-expectations The literal expected clause is independent of the renderer and retains both binding names and their order.
// @evidence contracts/testing.md#distinguishing-cases A fitting two-entry clause complements overflowing five-entry imports and malformed public Elements lists.
// @evidence contracts/testing.md#execution-ownership TestDispatchNamedImportsFlatWhenFits is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchNamedImportsFlatWhenFits(t *testing.T) {
  file := parseTS(t, "import { a, b } from \"x\";\n")
  node := firstNodeOfKind(t, file, shimast.KindNamedImports)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printNamedImports(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "{ a, b }" {
    t.Fatalf("flat named imports mismatch: %q", got)
  }
}
