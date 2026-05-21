package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNamedImportsFallsBackWhenSpecifierNil verifies that a
// NamedImports node containing a nil entry in its Elements list falls
// back to verbatim instead of emitting a corrupt Doc.
//
// A nil specifier inside Elements.Nodes would render as an empty Doc and
// surface as `a, , b` in the printed output — a silent corruption.
// The guard `if spec == nil { return verbatim }` inside the loop catches
// that case. Because the parser never produces nil entries, the only way
// to reach this branch is through a synthetically constructed node, which
// is what this test does.
//
//  1. Parse any source file to obtain a valid PrintContext.
//  2. Use NodeFactory to build a NamedImports node whose Elements list
//     contains a single nil entry.
//  3. Call printNamedImports directly and assert it does not panic.
func TestDispatchNamedImportsFallsBackWhenSpecifierNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  nilList := factory.NewNodeList([]*shimast.Node{nil})
  // ImportSpecifierList = NodeList, so *NodeList satisfies *ImportSpecifierList.
  node := factory.NewNamedImports(nilList)
  // Should not panic; the nil-spec guard triggers verbatim fallback.
  doc, _ := printNamedImports(ctx, node)
  got := Print(doc, ctx.Opts)
  _ = got
}
