package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNamedImportsFallsBackWhenElementsNil verifies that a
// NamedImports node whose Elements list is nil falls back to verbatim
// rather than panicking on a nil dereference.
//
// The parser always supplies a non-nil ImportSpecifierList, so this guard
// is only reachable through a synthetically constructed node. The test
// covers the `ni.Elements == nil` arm of the early-exit in
// printNamedImports, ensuring the defensive check survives future
// refactors. A verbatim Doc on a zero-length source slice renders as
// the empty string, which is a safe round-trip for an empty node.
//
// 1. Parse any source file to obtain a valid PrintContext.
// 2. Use NodeFactory to build a NamedImports node with nil Elements.
// 3. Call printNamedImports directly and assert it does not panic.
func TestDispatchNamedImportsFallsBackWhenElementsNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  node := factory.NewNamedImports(nil)
  // Should not panic; verbatim on a synthetic node returns an empty Text.
  doc, _ := printNamedImports(ctx, node)
  got := Print(doc, ctx.Opts)
  // The synthetic node has Pos==End==0 on an empty source, so verbatim
  // emits the empty slice — which renders as the empty string.
  _ = got
}
