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
//
// @evidence contracts/testing.md#behavioral-verification printObjectLiteral must render no object for an absent node.
// @evidence contracts/testing.md#independent-expectations No node supplies properties or source braces, giving the empty-layout identity.
// @evidence contracts/testing.md#distinguishing-cases Nil object complements intact singleton/multiple-property layouts and malformed Properties fallback.
// @evidence contracts/testing.md#execution-ownership TestDispatchObjectLiteralReturnsEmptyForNilNode is a plain top-level Go unit test, selectable with go test -run, that calls printObjectLiteral directly on a nil node with a PrintContext built from a trivial parsed file inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchObjectLiteralReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printObjectLiteral(ctx, nil)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-node object literal: want empty string, got %q", got)
  }
}
