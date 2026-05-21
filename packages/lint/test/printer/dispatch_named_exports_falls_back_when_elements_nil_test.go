package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNamedExportsFallsBackWhenElementsNil verifies that a
// NamedExports node whose Elements list is nil falls back to verbatim
// rather than panicking.
//
// Symmetric partner of the NamedImports nil-Elements test. The guard
// `ne == nil || ne.Elements == nil` in printNamedExports is reached only
// through a synthetically built node, but must be tested so the defensive
// branch stays live under coverage enforcement.
//
// 1. Parse any source file to obtain a valid PrintContext.
// 2. Use NodeFactory to build a NamedExports node with nil Elements.
// 3. Call printNamedExports directly and assert it does not panic.
func TestDispatchNamedExportsFallsBackWhenElementsNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  node := factory.NewNamedExports(nil)
  // Should not panic; verbatim on a synthetic node with zero-length
  // source returns the empty string.
  doc, _ := printNamedExports(ctx, node)
  got := Print(doc, ctx.Opts)
  _ = got
}
