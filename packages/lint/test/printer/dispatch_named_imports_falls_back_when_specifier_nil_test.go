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
//
// @evidence contracts/testing.md#behavioral-verification printNamedImports must retain both bindings verbatim when a parsed Elements list contains a nil specifier.
// @evidence contracts/testing.md#independent-expectations The literal { a, b } determines binding names and order without rerendering the expected source.
// @evidence contracts/testing.md#distinguishing-cases A missing entry complements absent Elements; valid named import lists are owned by flat/broken siblings.
// @evidence contracts/testing.md#execution-ownership TestDispatchNamedImportsFallsBackWhenSpecifierNil is a selected public Go unit under TestSelectedLintUnits. It parses or constructs an AST and calls its owning printer directly in the shared Go process; no consumer installation, native product build or product host executes.
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
  if got != "" {
    t.Fatalf("synthetic zero-range fallback must be empty, got %q", got)
  }

  parsed := parseTS(t, "import { a, b } from \"x\";\n")
  parsedNode := firstNodeOfKind(t, parsed, shimast.KindNamedImports)
  parsedNode.AsNamedImports().Elements.Nodes = []*shimast.Node{nil}
  parsedContext := NewPrintContext(parsed, DefaultPrintOptions())
  preserved, _ := printNamedImports(parsedContext, parsedNode)
  if output := Print(preserved, parsedContext.Opts); output != "{ a, b }" {
    t.Fatalf("malformed list must retain its original source: got %q, want %q", output, "{ a, b }")
  }
}
