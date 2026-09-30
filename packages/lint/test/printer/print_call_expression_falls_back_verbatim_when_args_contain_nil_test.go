package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintCallExpressionFallsBackVerbatimWhenArgsContainNil verifies that
// printCallExpression emits verbatim source bytes when the argument list
// contains a nil entry.
//
// hasNilEntry guards the call to printArgList so that a nil *Node in the
// argument slice (which would render as an empty Doc and produce `(a, , b)`)
// is handled safely. The verbatim fallback reproduces the original source
// unchanged. Existing tests always supply well-formed argument lists, so
// the true branch of `if hasNilEntry(...)` inside printCallExpression was
// never reached.
//
//  1. Parse `foo(a, b);` to get a real CallExpression.
//  2. Inject a nil *Node into the Arguments.Nodes slice.
//  3. Call printCallExpression and assert the output matches the verbatim
//     source `foo(a, b)` (the fallback reproduces the original bytes).
//
// @evidence contracts/testing.md#behavioral-verification printCallExpression must preserve foo(a, b) when its public argument list contains a nil child.
// @evidence contracts/testing.md#independent-expectations The independently authored parsed source supplies both binding names and punctuation; a corrupt reconstructed or empty call fails exact comparison.
// @evidence contracts/testing.md#distinguishing-cases A malformed public child list complements absent-node safety and the intact flat call; private payload corruption is not required.
// @evidence contracts/testing.md#execution-ownership TestPrintCallExpressionFallsBackVerbatimWhenArgsContainNil is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
func TestPrintCallExpressionFallsBackVerbatimWhenArgsContainNil(t *testing.T) {
  src := "foo(a, b);\n"
  file := parseTS(t, src)
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  call := node.AsCallExpression()

  // Inject a nil entry so hasNilEntry returns true.
  call.Arguments.Nodes = []*shimast.Node{nil}

  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printCallExpression(ctx, node)
  got := Print(doc, ctx.Opts)
  // The verbatim fallback copies the original source bytes for the node.
  // The node spans `foo(a, b)` (no trailing semicolon or newline).
  if got != "foo(a, b)" {
    t.Fatalf("verbatim fallback mismatch: %q", got)
  }
}
