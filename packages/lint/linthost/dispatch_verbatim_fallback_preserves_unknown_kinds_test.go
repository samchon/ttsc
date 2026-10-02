package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchVerbatimFallbackPreservesUnknownKinds verifies the
// dispatcher returns the original source bytes when no per-node
// printer is registered for the encountered kind.
//
// A TypeAliasDeclaration has no structured printer here. Its literal source
// declaration must survive dispatch and rendering without reconstruction.
// This case checks fallback bytes; it does not assert the coverage flag.
//
//  1. Parse `type Alias = number;`.
//  2. Grab the TypeAliasDeclaration node.
//  3. Dispatch via PrintNode and assert the rendered Doc round-trips
//     to the source bytes of the declaration.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must preserve the unsupported type-alias source rather than dropping or partially reconstructing it.
// @evidence contracts/testing.md#independent-expectations The full literal type Alias = number; supplies the independent fallback bytes.
// @evidence contracts/testing.md#distinguishing-cases An unknown single-line grammar kind complements supported structured expression layouts and unknown multiline subtrees that require abstention.
// @evidence contracts/testing.md#execution-ownership TestDispatchVerbatimFallbackPreservesUnknownKinds is one Go unit entry that parses a type alias in-process with the TypeScript-Go parser, dispatches the TypeAliasDeclaration through PrintNode and renders it with Print; it installs, builds and launches nothing.
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
