package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchImportDeclarationThreadsClauses verifies the
// ImportDeclaration printer correctly assembles `import { … } from
// "spec";` around the named-imports clause.
//
// printImportDeclaration builds the `import ` prefix, the specifier list
// and the ` from "x";` suffix into one printList group itself; it does not
// call printNamedImports. A regression in that assembly would drop the
// semicolon, eat the `from` keyword, or alter the module specifier.
//
//  1. Parse `import { a } from "x";`.
//  2. Render the ImportDeclaration node directly.
//  3. Assert the result round-trips to `import { a } from "x";`.
//
// @evidence contracts/testing.md#behavioral-verification printImportDeclaration must preserve import { a } from x including keywords, module string and semicolon.
// @evidence contracts/testing.md#independent-expectations The full literal declaration is independently authored; exact comparison catches lost or reordered clause tokens.
// @evidence contracts/testing.md#distinguishing-cases The ordinary value-named clause complements type-only and absent-terminator variants plus fallback import kinds.
// @evidence contracts/testing.md#execution-ownership TestDispatchImportDeclarationThreadsClauses is a plain top-level Go unit test, selectable with go test -run, that calls printImportDeclaration directly on a parsed named import with a semicolon inside the test process; it installs no consumer, builds no native artifact and starts no product host.
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
