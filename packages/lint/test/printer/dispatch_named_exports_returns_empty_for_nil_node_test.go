package linthost

import (
  "testing"
)

// TestDispatchNamedExportsReturnsEmptyForNilNode verifies the nil-node
// guard in printNamedExports returns an empty Doc without panicking.
//
// Symmetric partner of the NamedImports nil-node test. The guard is the
// same defensive branch: a nil node produces an empty Doc rather than a
// panic. Covering it here keeps the guard's behaviour explicit even
// though the normal dispatch cycle never reaches it with a nil argument.
//
// 1. Construct a PrintContext from a trivial parsed source.
// 2. Call printNamedExports with a nil node pointer.
// 3. Assert the rendered output is the empty string.
func TestDispatchNamedExportsReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "export {};\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printNamedExports(ctx, nil)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-node named exports: want empty string, got %q", got)
  }
}
