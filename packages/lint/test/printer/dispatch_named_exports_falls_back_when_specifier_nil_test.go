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
//
// @evidence contracts/testing.md#behavioral-verification printNamedExports must preserve { a, b } when a parsed specifier list contains nil, avoiding missing or invented export bindings.
// @evidence contracts/testing.md#independent-expectations The export fixture literal fixes both names and their order independently; the synthetic range contributes no source bytes.
// @evidence contracts/testing.md#distinguishing-cases A malformed specifier complements missing Elements and valid flat/broken export lists.
// @evidence contracts/testing.md#execution-ownership TestDispatchNamedExportsFallsBackWhenSpecifierNil is a selected public Go unit under TestSelectedLintUnits. It parses or constructs an AST and calls its owning printer directly in the shared Go process; no consumer installation, native compilation or product host executes.
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
  if got != "" {
    t.Fatalf("synthetic zero-range fallback must be empty, got %q", got)
  }

  parsed := parseTS(t, "export { a, b };\n")
  parsedNode := firstNodeOfKind(t, parsed, shimast.KindNamedExports)
  parsedNode.AsNamedExports().Elements.Nodes = []*shimast.Node{nil}
  parsedContext := NewPrintContext(parsed, DefaultPrintOptions())
  preserved, _ := printNamedExports(parsedContext, parsedNode)
  if output := Print(preserved, parsedContext.Opts); output != "{ a, b }" {
    t.Fatalf("malformed list must retain its original source: got %q, want %q", output, "{ a, b }")
  }
}
