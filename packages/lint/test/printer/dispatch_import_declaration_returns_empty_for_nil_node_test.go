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
func TestDispatchImportDeclarationReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printImportDeclaration(ctx, nil)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-node import declaration: want empty string, got %q", got)
  }
}
