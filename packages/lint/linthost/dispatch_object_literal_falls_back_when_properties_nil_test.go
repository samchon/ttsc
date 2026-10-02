package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchObjectLiteralFallsBackWhenPropertiesNil verifies that an
// ObjectLiteralExpression whose Properties list is nil falls back to
// verbatim rather than panicking on a nil NodeList dereference.
//
// The Properties list is a public field, so a node can be built or edited
// without one. The fallback must retain existing source bytes when a parsed
// node has a valid range, while a fresh factory node contributes no source
// text.
//
//  1. Parse any source file to obtain a valid PrintContext.
//  2. Use NodeFactory to build an ObjectLiteralExpression with nil
//     Properties, call printObjectLiteral directly and assert the output is
//     empty.
//  3. Parse `const values = { a: 1, b: 2 };`, clear the parsed node's
//     Properties and assert the output is the original `{ a: 1, b: 2 }`.
//
// @evidence contracts/testing.md#behavioral-verification printObjectLiteral must preserve { a: 1, b: 2 } when Properties is absent while keeping the original synthetic no-panic case.
// @evidence contracts/testing.md#independent-expectations The fixture literal is the verbatim oracle, retaining both key/value pairs independently of the printer.
// @evidence contracts/testing.md#distinguishing-cases An absent property list complements nil-entry fallback and valid flat/broken object layouts.
// @evidence contracts/testing.md#execution-ownership TestDispatchObjectLiteralFallsBackWhenPropertiesNil is a plain top-level Go unit test, selectable with go test -run, that calls printObjectLiteral directly on a factory-built object literal with no Properties and a parsed object whose Properties are cleared inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchObjectLiteralFallsBackWhenPropertiesNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  node := factory.NewObjectLiteralExpression(nil, false)
  // Should not panic; verbatim on a synthetic node returns an empty text.
  doc, _ := printObjectLiteral(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("synthetic zero-range fallback must be empty, got %q", got)
  }

  parsed := parseTS(t, "const values = { a: 1, b: 2 };\n")
  parsedNode := firstNodeOfKind(t, parsed, shimast.KindObjectLiteralExpression)
  parsedNode.AsObjectLiteralExpression().Properties = nil
  parsedContext := NewPrintContext(parsed, DefaultPrintOptions())
  preserved, _ := printObjectLiteral(parsedContext, parsedNode)
  if output := Print(preserved, parsedContext.Opts); output != "{ a: 1, b: 2 }" {
    t.Fatalf("malformed list must retain its original source: got %q, want %q", output, "{ a: 1, b: 2 }")
  }
}
