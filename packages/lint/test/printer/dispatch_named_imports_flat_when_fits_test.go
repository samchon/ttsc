package main

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
func TestDispatchNamedImportsFlatWhenFits(t *testing.T) {
  file := parseTS(t, "import { a, b } from \"x\";\n")
  node := firstNodeOfKind(t, file, shimast.KindNamedImports)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  got := Print(printNamedImports(ctx, node), ctx.Opts)
  if got != "{ a, b }" {
    t.Fatalf("flat named imports mismatch: %q", got)
  }
}
