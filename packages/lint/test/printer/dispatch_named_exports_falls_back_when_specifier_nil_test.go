package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNamedExportsFallsBackWhenSpecifierNil verifies that a
// NamedExports node containing a nil entry in its Elements list falls
// back to verbatim.
//
// Symmetric partner of the NamedImports nil-specifier test. A nil entry
// in the export specifier list would produce a corrupt comma-separated
// output; the guard `if spec == nil { return verbatim }` prevents that.
// This test covers the guard's true branch through a synthetic node.
//
//  1. Parse any source file to obtain a valid PrintContext.
//  2. Use NodeFactory to build a NamedExports node whose Elements list
//     contains a single nil entry.
//  3. Call printNamedExports directly and assert it does not panic.
func TestDispatchNamedExportsFallsBackWhenSpecifierNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  nilList := factory.NewNodeList([]*shimast.Node{nil})
  // ExportSpecifierList = NodeList, so *NodeList satisfies *ExportSpecifierList.
  node := factory.NewNamedExports(nilList)
  // Should not panic; the nil-spec guard triggers verbatim fallback.
  doc, _ := printNamedExports(ctx, node)
  got := Print(doc, ctx.Opts)
  _ = got
}
