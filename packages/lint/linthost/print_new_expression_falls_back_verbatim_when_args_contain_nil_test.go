package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPrintNewExpressionFallsBackVerbatimWhenArgsContainNil verifies that
// printNewExpression emits verbatim source bytes when the argument list
// contains a nil entry.
//
// The hasNilEntry guard inside the `if ne.Arguments != nil` arm of
// printNewExpression prevents a nil *Node child from rendering as an empty
// Doc (which would produce `new Foo(a, , b)`). Existing tests always supply
// well-formed argument lists, leaving the true branch of the guard
// uncovered.
//
//  1. Parse `new Foo(a, b);` to get a real NewExpression.
//  2. Inject a nil *Node into the Arguments.Nodes slice.
//  3. Call printNewExpression and assert the output matches the verbatim
//     source `new Foo(a, b)`.
//
// @evidence contracts/testing.md#behavioral-verification printNewExpression must retain new Foo(a, b) rather than reconstructing an incomplete constructor when arguments contain nil.
// @evidence contracts/testing.md#independent-expectations The parsed fixture source independently fixes new, Foo and both arguments; exact equality detects dropped or invented tokens.
// @evidence contracts/testing.md#distinguishing-cases A malformed public argument entry complements valid type arguments, no argument list and absent node cases.
// @evidence contracts/testing.md#execution-ownership TestPrintNewExpressionFallsBackVerbatimWhenArgsContainNil is one Go unit entry that parses a new expression in-process with the TypeScript-Go parser, replaces its argument slice with a single nil entry, calls printNewExpression and renders the Doc with Print; it installs, builds and launches nothing.
func TestPrintNewExpressionFallsBackVerbatimWhenArgsContainNil(t *testing.T) {
  src := "new Foo(a, b);\n"
  file := parseTS(t, src)
  node := firstNodeOfKind(t, file, shimast.KindNewExpression)
  ne := node.AsNewExpression()

  // Inject a nil entry so hasNilEntry returns true.
  ne.Arguments.Nodes = []*shimast.Node{nil}

  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printNewExpression(ctx, node)
  got := Print(doc, ctx.Opts)
  // The verbatim fallback reproduces the original source for the node.
  if got != "new Foo(a, b)" {
    t.Fatalf("verbatim fallback mismatch: %q", got)
  }
}
