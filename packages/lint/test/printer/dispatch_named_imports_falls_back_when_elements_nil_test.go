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
//
// @evidence contracts/testing.md#behavioral-verification printNamedImports must retain { a, b } instead of losing the bindings when Elements is nil.
// @evidence contracts/testing.md#independent-expectations The independently supplied import source determines the exact binding clause; empty synthetic range remains an empty-output boundary.
// @evidence contracts/testing.md#distinguishing-cases The absent list complements malformed specifier and valid flat/broken named imports.
// @evidence contracts/testing.md#execution-ownership TestDispatchNamedImportsFallsBackWhenElementsNil is a selected public Go unit under TestSelectedLintUnits. It parses or constructs an AST and calls its owning printer directly in the shared Go process; no consumer installation, native product build or product host executes.
func TestDispatchNamedImportsFallsBackWhenElementsNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  node := factory.NewNamedImports(nil)
  // Should not panic; verbatim on a synthetic node returns an empty Text.
  doc, _ := printNamedImports(ctx, node)
  got := Print(doc, ctx.Opts)
  // The factory node has an undefined negative range, so verbatim
  // contributes no source bytes — which renders as the empty string.
  if got != "" {
    t.Fatalf("synthetic zero-range fallback must be empty, got %q", got)
  }

  parsed := parseTS(t, "import { a, b } from \"x\";\n")
  parsedNode := firstNodeOfKind(t, parsed, shimast.KindNamedImports)
  parsedNode.AsNamedImports().Elements = nil
  parsedContext := NewPrintContext(parsed, DefaultPrintOptions())
  preserved, _ := printNamedImports(parsedContext, parsedNode)
  if output := Print(preserved, parsedContext.Opts); output != "{ a, b }" {
    t.Fatalf("malformed list must retain its original source: got %q, want %q", output, "{ a, b }")
  }
}
