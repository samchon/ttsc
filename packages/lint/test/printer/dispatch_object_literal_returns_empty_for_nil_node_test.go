package linthost

import (
  "testing"
)

// TestDispatchObjectLiteralReturnsEmptyForNilNode verifies the nil-node
// guard in printObjectLiteral returns an empty Doc without panicking.
//
// The nil guard is a defensive layer present in every per-node printer.
// Because the dispatch loop calls PrintNode (which already filters nils),
// this branch is only reachable through a direct printObjectLiteral call.
// Pinning it here ensures the guard survives future cleanups.
//
// 1. Construct a PrintContext from a trivial parsed source.
// 2. Call printObjectLiteral with a nil node pointer.
// 3. Assert the rendered output is the empty string.
func TestDispatchObjectLiteralReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printObjectLiteral(ctx, nil)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-node object literal: want empty string, got %q", got)
  }
}
