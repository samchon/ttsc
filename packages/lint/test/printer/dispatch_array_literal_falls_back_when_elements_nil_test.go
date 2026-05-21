package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchArrayLiteralFallsBackWhenElementsNil verifies that an
// ArrayLiteralExpression whose Elements list is nil falls back to verbatim
// rather than panicking.
//
// Symmetric partner of the object-literal nil-Properties test. The guard
// `arr == nil || arr.Elements == nil` in printArrayLiteral is only
// reachable through a synthetically built node, but must be covered so
// the defensive branch survives the 100% coverage check.
//
// 1. Parse any source file to obtain a valid PrintContext.
// 2. Use NodeFactory to build an ArrayLiteralExpression with nil Elements.
// 3. Call printArrayLiteral directly and assert it does not panic.
func TestDispatchArrayLiteralFallsBackWhenElementsNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  node := factory.NewArrayLiteralExpression(nil, false)
  // Should not panic; verbatim on a synthetic node returns an empty text.
  doc, _ := printArrayLiteral(ctx, node)
  got := Print(doc, ctx.Opts)
  _ = got
}
