package linthost

import (
  "testing"
)

// TestDispatchNamedImportsReturnsEmptyForNilNode verifies the nil-node
// guard in printNamedImports returns an empty Doc without panicking.
//
// The nil guard is a defensive branch. PrintNode screens nil before
// dispatching, so the branch is reachable only through a direct
// printNamedImports call, which is what this case makes.
//
// 1. Construct a PrintContext from a trivial parsed source.
// 2. Call printNamedImports with a nil node pointer.
// 3. Assert the rendered output is the empty string.
//
// @evidence contracts/testing.md#behavioral-verification printNamedImports must produce no clause for nil.
// @evidence contracts/testing.md#independent-expectations An absent named-bindings node contributes no source bytes or delimiters.
// @evidence contracts/testing.md#distinguishing-cases The nil boundary complements nonempty flat/broken imports and missing-list or missing-item fallbacks.
// @evidence contracts/testing.md#execution-ownership TestDispatchNamedImportsReturnsEmptyForNilNode is a plain top-level Go unit test, selectable with go test -run, that calls printNamedImports directly on a nil node with a PrintContext built from a trivial parsed file inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchNamedImportsReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "export {};\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printNamedImports(ctx, nil)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-node named imports: want empty string, got %q", got)
  }
}
