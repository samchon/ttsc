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
//
// @evidence contracts/testing.md#behavioral-verification printObjectLiteral must preserve the original key/value source when Properties.Nodes contains nil.
// @evidence contracts/testing.md#independent-expectations The literal { a: 1, b: 2 } prevents an empty or partly reconstructed object from passing; the original synthetic empty output is also asserted.
// @evidence contracts/testing.md#distinguishing-cases A malformed entry complements absent Properties and valid property lists in the flat/broken object cases.
// @evidence contracts/testing.md#execution-ownership TestDispatchObjectLiteralFallsBackWhenPropertyNil is a selected public Go unit under TestSelectedLintUnits. It parses or constructs an AST and calls its owning printer directly in the shared Go process; no consumer installation, native compilation or product host executes.
func TestDispatchObjectLiteralFallsBackWhenPropertyNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  nilList := factory.NewNodeList([]*shimast.Node{nil})
  node := factory.NewObjectLiteralExpression(nilList, false)
  // Should not panic; the nil-property guard triggers verbatim fallback.
  doc, _ := printObjectLiteral(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("synthetic zero-range fallback must be empty, got %q", got)
  }

  parsed := parseTS(t, "const values = { a: 1, b: 2 };\n")
  parsedNode := firstNodeOfKind(t, parsed, shimast.KindObjectLiteralExpression)
  parsedNode.AsObjectLiteralExpression().Properties.Nodes = []*shimast.Node{nil}
  parsedContext := NewPrintContext(parsed, DefaultPrintOptions())
  preserved, _ := printObjectLiteral(parsedContext, parsedNode)
  if output := Print(preserved, parsedContext.Opts); output != "{ a: 1, b: 2 }" {
    t.Fatalf("malformed list must retain its original source: got %q, want %q", output, "{ a: 1, b: 2 }")
  }
}
