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
