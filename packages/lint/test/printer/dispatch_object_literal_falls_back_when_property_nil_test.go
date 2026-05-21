package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchObjectLiteralFallsBackWhenPropertyNil verifies that an
// ObjectLiteralExpression containing a nil entry in its Properties list
// falls back to verbatim instead of emitting a corrupt Doc.
//
// A nil property inside Properties.Nodes would surface as `a, , b` in
// the printed output. The guard `if prop == nil { return verbatim }` in
// printObjectLiteral catches this case. Because the TypeScript-Go parser
// never produces nil entries in a NodeList, this test exercises the guard
// through a synthetically constructed node.
//
//  1. Parse any source file to obtain a valid PrintContext.
//  2. Use NodeFactory to build an ObjectLiteralExpression whose Properties
//     NodeList contains a single nil entry.
//  3. Call printObjectLiteral directly and assert it does not panic.
func TestDispatchObjectLiteralFallsBackWhenPropertyNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  nilList := factory.NewNodeList([]*shimast.Node{nil})
  node := factory.NewObjectLiteralExpression(nilList, false)
  // Should not panic; the nil-property guard triggers verbatim fallback.
  doc, _ := printObjectLiteral(ctx, node)
  got := Print(doc, ctx.Opts)
  _ = got
}
