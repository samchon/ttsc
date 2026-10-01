package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchArrowFunctionBlockBodyReindentsConsistently verifies the
// arrow-function printer re-indents a block body so the header, body
// statements, and closing brace land at consistent columns.
//
// This pins the headline corruption fix. Before the arrow-function
// printer existed, an arrow fell through to verbatim and its body lines
// kept the source columns they were written at, while the enclosing
// call re-indented the `() =>` header — leaving the header and body at
// mismatched indents. The block printer now re-emits every statement at
// the engine-controlled indent, so a reflow can never strand a body
// line at the wrong column.
//
//  1. Parse `const run = () => { doStuff(); return 1; };`.
//  2. Dispatch the ArrowFunction through PrintNode.
//  3. Assert the body statements indent exactly two spaces under the
//     `=>` header and the closing brace returns to column 0.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must reindent the arrow block while retaining doStuff followed by return 1 and report complete coverage.
// @evidence contracts/testing.md#independent-expectations The full literal expected arrow preserves its signature, both statements and ordering; only braces and indentation change.
// @evidence contracts/testing.md#distinguishing-cases A one-line valid block that must expand complements the nil-body and multiline-signature abstention cases.
// @evidence contracts/testing.md#execution-ownership TestDispatchArrowFunctionBlockBodyReindentsConsistently is a plain top-level Go unit test, selectable with go test -run, that calls PrintNode directly on a parsed arrow function with a block body inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchArrowFunctionBlockBodyReindentsConsistently(t *testing.T) {
  file := parseTS(t, "const run = () => { doStuff(); return 1; };\n")
  node := firstNodeOfKind(t, file, shimast.KindArrowFunction)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("arrow with plain block body should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "() => {\n  doStuff();\n  return 1;\n}"
  if got != want {
    t.Fatalf("arrow block body mismatch:\nwant %q\ngot  %q", want, got)
  }
}
