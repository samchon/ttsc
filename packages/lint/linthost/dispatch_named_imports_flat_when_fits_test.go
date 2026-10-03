package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNamedImportsFlatWhenFits verifies short `{ a, b }`
// import clauses keep one line.
//
// The named-imports printer shares listShape with object literals, so
// flat behavior is mostly inherited; this case pins the standalone
// clause printer that the dispatcher selects for a NamedImports node
// (printImportDeclaration builds its own list and does not call it).
//
//  1. Parse `import { a, b } from "x";`.
//  2. Render the NamedImports node directly under default options.
//  3. Assert `{ a, b }`.
//
// @evidence contracts/testing.md#behavioral-verification printNamedImports must retain { a, b } on one line with the supported brace spacing.
// @evidence contracts/testing.md#independent-expectations The literal expected clause is independent of the renderer and retains both binding names and their order.
// @evidence contracts/testing.md#distinguishing-cases A fitting two-entry clause complements overflowing five-entry imports and malformed public Elements lists.
// @evidence contracts/testing.md#execution-ownership TestDispatchNamedImportsFlatWhenFits is a plain top-level Go unit test, selectable with go test -run, that calls printNamedImports directly on a parsed two-specifier import clause at the default width inside the test process; it installs no consumer, builds no native artifact and starts no product host.
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
