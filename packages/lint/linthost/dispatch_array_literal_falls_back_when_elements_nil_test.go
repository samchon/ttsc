package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchArrayLiteralFallsBackWhenElementsNil verifies that an
// ArrayLiteralExpression whose Elements list is nil falls back to verbatim
// rather than panicking.
//
// Plugins can supply a factory node or remove a public Elements list.
// Missing structure must not panic or discard the original source when
// the node still has a valid parsed range.
//
// 1. Parse any source file to obtain a valid PrintContext.
// 2. Use NodeFactory to build an ArrayLiteralExpression with nil Elements.
// 3. Call printArrayLiteral directly and assert the synthetic node prints
//    empty without panicking.
// 4. Repeat on a parsed `[a, b]` whose Elements list is cleared and assert
//    the original `[a, b]` source is preserved.
//
// @evidence contracts/testing.md#behavioral-verification printArrayLiteral must preserve [a, b] when its parsed Elements list is nil, and return empty for the original synthetic range.
// @evidence contracts/testing.md#independent-expectations The fixture source supplies independent verbatim bytes; an unconditional empty result would now fail the nonempty case.
// @evidence contracts/testing.md#distinguishing-cases A missing list complements a list containing a nil element and the valid flat/broken array cases.
// @evidence contracts/testing.md#execution-ownership TestDispatchArrayLiteralFallsBackWhenElementsNil is a plain top-level Go unit test, selectable with go test -run, that calls printArrayLiteral directly on a factory-built array with no Elements and a parsed array whose Elements are cleared inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchArrayLiteralFallsBackWhenElementsNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  node := factory.NewArrayLiteralExpression(nil, false)
  // Should not panic; verbatim on a synthetic node returns an empty text.
  doc, _ := printArrayLiteral(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("synthetic undefined-range fallback must be empty, got %q", got)
  }

  parsed := parseTS(t, "const values = [a, b];\n")
  parsedNode := firstNodeOfKind(t, parsed, shimast.KindArrayLiteralExpression)
  parsedNode.AsArrayLiteralExpression().Elements = nil
  parsedContext := NewPrintContext(parsed, DefaultPrintOptions())
  preserved, _ := printArrayLiteral(parsedContext, parsedNode)
  if output := Print(preserved, parsedContext.Opts); output != "[a, b]" {
    t.Fatalf("malformed list must retain its original source: got %q, want %q", output, "[a, b]")
  }
}
