package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must preserve the unsupported type-alias source rather than dropping or partially reconstructing it.
// @evidence contracts/testing.md#independent-expectations The full literal type Alias = number; supplies the independent fallback bytes.
// @evidence contracts/testing.md#distinguishing-cases An unknown single-line grammar kind complements supported structured expression layouts and unknown multiline subtrees that require abstention.
// @evidence contracts/testing.md#execution-ownership TestDispatchVerbatimFallbackPreservesUnknownKinds is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
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
