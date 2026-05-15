package main

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
func TestDispatchImportDeclarationThreadsClauses(t *testing.T) {
  file := parseTS(t, "import { a } from \"x\";\n")
  node := firstNodeOfKind(t, file, shimast.KindImportDeclaration)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  got := Print(printImportDeclaration(ctx, node), ctx.Opts)
  if got != "import { a } from \"x\";" {
    t.Fatalf("import declaration mismatch: %q", got)
  }
}
