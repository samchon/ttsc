package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchVerbatimFallbackPreservesUnknownKinds verifies the
// dispatcher returns the original source bytes when no per-node
// printer is registered for the encountered kind.
//
// Verbatim fallback is the safety net for the partial-coverage v1 of
// `format/print-width`: a rule that ever lost bytes when encountering
// an un-handled shape would be unfit for `ttsc format`. The case
// passes a TypeScript-only node kind the dispatcher does not handle
// (TypeAliasDeclaration) and asserts the rendered output equals the
// trivia-trimmed original.
//
//  1. Parse `type Alias = number;`.
//  2. Grab the TypeAliasDeclaration node.
//  3. Dispatch via PrintNode and assert the rendered Doc round-trips
//     to the source bytes of the declaration.
func TestDispatchVerbatimFallbackPreservesUnknownKinds(t *testing.T) {
  src := "type Alias = number;\n"
  file := parseTS(t, src)
  node := firstNodeOfKind(t, file, shimast.KindTypeAliasDeclaration)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := PrintNode(ctx, node)
  got := Print(doc, ctx.Opts)
  // The verbatim path uses SkipTrivia, so leading whitespace is
  // already trimmed. The fixture has no leading whitespace, so the
  // declaration's bytes equal the trimmed source up to the trailing
  // newline.
  want := "type Alias = number;"
  if got != want {
    t.Fatalf("verbatim fallback mismatch:\nwant %q\ngot  %q", want, got)
  }
}
