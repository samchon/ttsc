package linthost

import (
  "testing"
)

// TestDispatchImportDeclarationReturnsEmptyForNilNode verifies the nil-node
// guard in printImportDeclaration returns an empty Doc without panicking.
//
// The nil guard at the top of printImportDeclaration is the standard
// defensive check shared by every per-node printer in the package. This
// test pins the nil-argument path so a future refactor cannot
// accidentally remove the guard without a test failure.
//
// 1. Construct a PrintContext from a trivial parsed source.
// 2. Call printImportDeclaration with a nil node pointer.
// 3. Assert the rendered output is the empty string.
//
// @evidence contracts/testing.md#behavioral-verification printImportDeclaration must render no import for an absent node.
// @evidence contracts/testing.md#independent-expectations A missing declaration has no source span or module to import, giving the empty layout identity.
// @evidence contracts/testing.md#distinguishing-cases Nil declaration complements the nonempty default/namespace/side-effect and named-import cases.
// @evidence contracts/testing.md#execution-ownership TestDispatchImportDeclarationReturnsEmptyForNilNode is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchImportDeclarationReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printImportDeclaration(ctx, nil)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-node import declaration: want empty string, got %q", got)
  }
}
