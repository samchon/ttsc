package main

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
func TestDispatchImportDeclarationPreservesTypeOnlyKeyword(t *testing.T) {
  file := parseTS(t, "import type { A } from \"x\";\n")
  node := firstNodeOfKind(t, file, shimast.KindImportDeclaration)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  got := Print(printImportDeclaration(ctx, node), ctx.Opts)
  if got != "import type { A } from \"x\";" {
    t.Fatalf("type-only import mismatch: %q", got)
  }
}
