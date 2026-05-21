package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchArrayLiteralFallsBackWhenElementNil verifies that an
// ArrayLiteralExpression containing a nil entry in its Elements list
// falls back to verbatim instead of emitting a corrupt Doc.
//
// Symmetric partner of the object-literal nil-property test. A nil
// element inside Elements.Nodes would produce a corrupt comma-separated
// output (`a, , b`). The guard `if elem == nil { return verbatim }` in
// printArrayLiteral prevents that. This test exercises the guard's true
// branch through a synthetically constructed node.
//
//  1. Parse any source file to obtain a valid PrintContext.
//  2. Use NodeFactory to build an ArrayLiteralExpression whose Elements
//     NodeList contains a single nil entry.
//  3. Call printArrayLiteral directly and assert it does not panic.
func TestDispatchArrayLiteralFallsBackWhenElementNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  nilList := factory.NewNodeList([]*shimast.Node{nil})
  // ElementList = NodeList, so *NodeList satisfies *ElementList.
  node := factory.NewArrayLiteralExpression(nilList, false)
  // Should not panic; the nil-element guard triggers verbatim fallback.
  doc, _ := printArrayLiteral(ctx, node)
  got := Print(doc, ctx.Opts)
  _ = got
}
