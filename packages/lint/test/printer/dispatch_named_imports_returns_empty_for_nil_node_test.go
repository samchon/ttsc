package linthost

import (
  "testing"
)

// TestDispatchNamedImportsReturnsEmptyForNilNode verifies the nil-node
// guard in printNamedImports returns an empty Doc without panicking.
//
// The nil guard is a defensive branch that protects callers who route a
// nil pointer through the dispatcher (for example, after a failed AST
// lookup). Leaving it untested allowed a coverage gap even though the
// path is never reached through the normal dispatch cycle — the branch
// must still compile and return a defined value.
//
// 1. Construct a PrintContext from a trivial parsed source.
// 2. Call printNamedImports with a nil node pointer.
// 3. Assert the rendered output is the empty string.
func TestDispatchNamedImportsReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "export {};\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printNamedImports(ctx, nil)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-node named imports: want empty string, got %q", got)
  }
}
