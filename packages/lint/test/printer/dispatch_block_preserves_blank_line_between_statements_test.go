package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchBlockPreservesBlankLineBetweenStatements verifies the
// block printer keeps a single user-authored blank line between two
// statements instead of deleting it.
//
// printBlock mints fresh Hardline separators between statements; a bare
// `Join(Hardline, …)` joined them with exactly one newline, so a blank
// line a developer wrote between two callback-body statements was
// silently erased on the first `ttsc format` pass. The blank line is
// emitted as a Literalline so the empty line carries no trailing
// indentation whitespace.
//
//  1. Parse a callback body with a blank line between `setup();` and
//     `teardown();`.
//  2. Dispatch the Block through PrintNode at the default width.
//  3. Assert the rendered block keeps exactly one empty line between
//     the two statements.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must retain the blank line separating setup from teardown and report complete coverage.
// @evidence contracts/testing.md#independent-expectations The full expected block fixes both statement order and the intentional empty line independently of the printer.
// @evidence contracts/testing.md#distinguishing-cases A two-break statement gap complements the ordinary consecutive-statements block and predicate one-break negative.
// @evidence contracts/testing.md#execution-ownership TestDispatchBlockPreservesBlankLineBetweenStatements is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchBlockPreservesBlankLineBetweenStatements(t *testing.T) {
  file := parseTS(t, "register(() => {\n  setup();\n\n  teardown();\n});\n")
  node := firstNodeOfKind(t, file, shimast.KindBlock)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("callback body of single-line statements should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "{\n  setup();\n\n  teardown();\n}"
  if got != want {
    t.Fatalf("blank-line preservation mismatch:\nwant %q\ngot  %q", want, got)
  }
}
