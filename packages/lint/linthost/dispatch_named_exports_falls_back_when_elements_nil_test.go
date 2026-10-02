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
//  1. Parse any source file to obtain a valid PrintContext.
//  2. Use NodeFactory to build a NamedExports node with nil Elements, call
//     printNamedExports directly and assert the output is empty.
//  3. Parse `export { a, b };`, clear the parsed node's Elements and assert
//     the output is the original `{ a, b }`.
//
// @evidence contracts/testing.md#behavioral-verification printNamedExports must retain the original { a, b } clause when Elements is nil.
// @evidence contracts/testing.md#independent-expectations The independently authored export fixture specifies the exact source bytes; the synthetic no-range fallback must be empty.
// @evidence contracts/testing.md#distinguishing-cases An absent list complements a nil specifier and the valid flat/broken exports cases.
// @evidence contracts/testing.md#execution-ownership TestDispatchNamedExportsFallsBackWhenElementsNil is a plain top-level Go unit test, selectable with go test -run, that calls printNamedExports directly on a factory-built NamedExports with no Elements and a parsed clause whose Elements are cleared inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchNamedExportsFallsBackWhenElementsNil(t *testing.T) {
  file := parseTS(t, "\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  node := factory.NewNamedExports(nil)
  // Should not panic; verbatim on a synthetic node with zero-length
  // source returns the empty string.
  doc, _ := printNamedExports(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("synthetic zero-range fallback must be empty, got %q", got)
  }

  parsed := parseTS(t, "export { a, b };\n")
  parsedNode := firstNodeOfKind(t, parsed, shimast.KindNamedExports)
  parsedNode.AsNamedExports().Elements = nil
  parsedContext := NewPrintContext(parsed, DefaultPrintOptions())
  preserved, _ := printNamedExports(parsedContext, parsedNode)
  if output := Print(preserved, parsedContext.Opts); output != "{ a, b }" {
    t.Fatalf("malformed list must retain its original source: got %q, want %q", output, "{ a, b }")
  }
}
