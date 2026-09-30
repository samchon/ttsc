package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchBlockKeepsCoveredForSingleLineStatements verifies the
// block printer reports `covered == true` when every statement is
// confined to a single source line, even though those statements fall
// back to the verbatim printer.
//
// Single-line verbatim is reflow-safe: a node that lives on one line
// has no interior column for the enclosing re-indent to strand. The
// block printer must distinguish this safe case from the multi-line
// verbatim hazard — treating every verbatim statement as uncovered
// would make the rule abstain on the common `() => { a(); b(); }`
// shape and never reflow it.
//
//  1. Parse a block whose two statements (`a();`, `b();`) each occupy
//     one line.
//  2. Dispatch the Block through PrintNode.
//  3. Assert `covered` is true and the statements render one per line.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must retain a() then b() in a consistently indented block and report it fully covered.
// @evidence contracts/testing.md#independent-expectations The authored block literal preserves both calls, statement separators and order with two-space indentation.
// @evidence contracts/testing.md#distinguishing-cases Plain nonempty statements complement empty blocks and inter-statement comments that must prevent coverage.
// @evidence contracts/testing.md#execution-ownership TestDispatchBlockKeepsCoveredForSingleLineStatements is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchBlockKeepsCoveredForSingleLineStatements(t *testing.T) {
  file := parseTS(t, "function f() {\n  a();\n  b();\n}\n")
  node := firstNodeOfKind(t, file, shimast.KindBlock)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("block of single-line statements should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "{\n  a();\n  b();\n}"
  if got != want {
    t.Fatalf("block render mismatch:\nwant %q\ngot  %q", want, got)
  }
}
