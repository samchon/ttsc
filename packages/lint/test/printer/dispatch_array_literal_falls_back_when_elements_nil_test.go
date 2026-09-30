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
//
// @evidence contracts/testing.md#behavioral-verification printArrayLiteral must preserve [a, b] when its parsed Elements list is nil, and return empty for the original synthetic range.
// @evidence contracts/testing.md#independent-expectations The fixture source supplies independent verbatim bytes; an unconditional empty result would now fail the nonempty case.
// @evidence contracts/testing.md#distinguishing-cases A missing list complements a list containing a nil element and the valid flat/broken array cases.
// @evidence contracts/testing.md#execution-ownership TestDispatchArrayLiteralFallsBackWhenElementsNil is a selected public Go unit under TestSelectedLintUnits. It parses or constructs an AST and calls its owning printer directly in the shared Go process; no consumer installation, native compilation or product host executes.
func TestDispatchArrayLiteralFallsBackWhenElementsNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  node := factory.NewArrayLiteralExpression(nil, false)
  // Should not panic; verbatim on a synthetic node returns an empty text.
  doc, _ := printArrayLiteral(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("synthetic zero-range fallback must be empty, got %q", got)
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
