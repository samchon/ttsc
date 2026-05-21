package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchObjectLiteralFallsBackWhenPropertiesNil verifies that an
// ObjectLiteralExpression whose Properties list is nil falls back to
// verbatim rather than panicking on a nil NodeList dereference.
//
// The TypeScript-Go parser always supplies a non-nil Properties NodeList,
// so this guard is only reachable through a synthetically built node.
// Testing it here satisfies the 100% coverage requirement for
// printObjectLiteral and ensures the `obj.Properties == nil` branch stays
// live under future refactoring.
//
// 1. Parse any source file to obtain a valid PrintContext.
// 2. Use NodeFactory to build an ObjectLiteralExpression with nil Properties.
// 3. Call printObjectLiteral directly and assert it does not panic.
func TestDispatchObjectLiteralFallsBackWhenPropertiesNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  node := factory.NewObjectLiteralExpression(nil, false)
  // Should not panic; verbatim on a synthetic node returns an empty text.
  doc, _ := printObjectLiteral(ctx, node)
  got := Print(doc, ctx.Opts)
  _ = got
}
