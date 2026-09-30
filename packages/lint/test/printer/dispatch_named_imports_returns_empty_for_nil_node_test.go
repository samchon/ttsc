package linthost

import (
  "testing"
)

// TestDispatchNamedImportsReturnsEmptyForNilNode verifies the nil-node
// guard in printNamedImports returns an empty Doc without panicking.
//
// The nil guard is a defensive branch that protects callers who route a
// nil pointer through the dispatcher (for example, after a failed AST
// lookup). Leaving it untested allowed a coverage gap even though the
// path is never reached through the normal dispatch cycle — the branch
// must still compile and return a defined value.
//
// 1. Construct a PrintContext from a trivial parsed source.
// 2. Call printNamedImports with a nil node pointer.
// 3. Assert the rendered output is the empty string.
//
// @evidence contracts/testing.md#behavioral-verification printNamedImports must produce no clause for nil.
// @evidence contracts/testing.md#independent-expectations An absent named-bindings node contributes no source bytes or delimiters.
// @evidence contracts/testing.md#distinguishing-cases The nil boundary complements nonempty flat/broken imports and missing-list or missing-item fallbacks.
// @evidence contracts/testing.md#execution-ownership TestDispatchNamedImportsReturnsEmptyForNilNode is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchNamedImportsReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "export {};\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printNamedImports(ctx, nil)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-node named imports: want empty string, got %q", got)
  }
}
