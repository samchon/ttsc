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
//  1. Parse any source file to obtain a valid PrintContext.
//  2. Use NodeFactory to build a NamedImports node with nil Elements, call
//     printNamedImports directly and assert the output is empty.
//  3. Parse `import { a, b } from "x";`, clear the parsed node's Elements and
//     assert the output is the original `{ a, b }`.
//
// @evidence contracts/testing.md#behavioral-verification printNamedImports must retain { a, b } instead of losing the bindings when Elements is nil.
// @evidence contracts/testing.md#independent-expectations The independently supplied import source determines the exact binding clause; empty synthetic range remains an empty-output boundary.
// @evidence contracts/testing.md#distinguishing-cases The absent list complements malformed specifier and valid flat/broken named imports.
// @evidence contracts/testing.md#execution-ownership TestDispatchNamedImportsFallsBackWhenElementsNil is a plain top-level Go unit test, selectable with go test -run, that calls printNamedImports directly on a factory-built NamedImports with no Elements and a parsed clause whose Elements are cleared inside the test process; it installs no consumer, builds no native artifact and starts no product host.
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
