package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchImportDeclarationOmitsSemicolonWhenAbsent verifies that
// `import { a } from "x"` (without a trailing semicolon) is reconstructed
// without a trailing `;`.
//
// The printer calls sourceHasStatementTerminator to decide whether to
// append a `;` token. When the user wrote ASI (no explicit semicolon), the
// function must return false and the printer must emit nothing. Emitting `;`
// unconditionally would collide with `format/semi`'s zero-width insert on
// the same cascade pass and produce `;;`. This case covers the false branch
// of the terminator check so that contract is pinned at the unit level.
//
// 1. Parse `import { a } from "x"` followed only by a newline (no `;`).
// 2. Dispatch the ImportDeclaration node through printImportDeclaration.
// 3. Assert the output equals the source text, still without a `;`.
//
// @evidence contracts/testing.md#behavioral-verification printImportDeclaration must retain the author-written import without inventing a final semicolon.
// @evidence contracts/testing.md#independent-expectations The literal source ends after the quoted module; its exact output is independent of terminator detection.
// @evidence contracts/testing.md#distinguishing-cases Absent terminator contrasts with the same ordinary named import that includes a semicolon.
// @evidence contracts/testing.md#execution-ownership TestDispatchImportDeclarationOmitsSemicolonWhenAbsent is a plain top-level Go unit test, selectable with go test -run, that calls printImportDeclaration directly on a parsed named import written without a semicolon inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchImportDeclarationOmitsSemicolonWhenAbsent(t *testing.T) {
  src := "import { a } from \"x\"\n"
  file := parseTS(t, src)
  node := firstNodeOfKind(t, file, shimast.KindImportDeclaration)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printImportDeclaration(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "import { a } from \"x\"" {
    t.Fatalf("no-semicolon import mismatch: %q", got)
  }
}
