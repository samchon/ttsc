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
//  3. Call printArrayLiteral directly and assert the synthetic node prints
//     empty without panicking.
//  4. Repeat on a parsed `[a, b]` whose Elements.Nodes is replaced by a nil
//     entry and assert the original `[a, b]` source is preserved.
//
// @evidence contracts/testing.md#behavioral-verification printArrayLiteral must preserve [a, b] when Elements.Nodes contains nil instead of synthesizing a corrupt list.
// @evidence contracts/testing.md#independent-expectations The original source literal independently fixes element spelling and order; the factory node has an undefined source range and independently requires empty fallback output.
// @evidence contracts/testing.md#distinguishing-cases The malformed entry differs from absent Elements and valid flat/broken arrays, each owned by sibling cases.
// @evidence contracts/testing.md#execution-ownership TestDispatchArrayLiteralFallsBackWhenElementNil is a plain top-level Go unit test, selectable with go test -run, that calls printArrayLiteral directly on a factory-built array holding a nil element and a parsed array whose Elements.Nodes is replaced by nil inside the test process; it installs no consumer, builds no native artifact and starts no product host.
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
  if got != "" {
    t.Fatalf("synthetic undefined-range fallback must be empty, got %q", got)
  }

  parsed := parseTS(t, "const values = [a, b];\n")
  parsedNode := firstNodeOfKind(t, parsed, shimast.KindArrayLiteralExpression)
  parsedNode.AsArrayLiteralExpression().Elements.Nodes = []*shimast.Node{nil}
  parsedContext := NewPrintContext(parsed, DefaultPrintOptions())
  preserved, _ := printArrayLiteral(parsedContext, parsedNode)
  if output := Print(preserved, parsedContext.Opts); output != "[a, b]" {
    t.Fatalf("malformed list must retain its original source: got %q, want %q", output, "[a, b]")
  }
}
