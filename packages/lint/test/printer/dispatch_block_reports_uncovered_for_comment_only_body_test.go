package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchBlockReportsUncoveredForCommentOnlyBody verifies the block
// printer reports `covered == false` for a statement-free block that
// holds only a comment spanning its own line.
//
// A block with no statements would normally collapse to `{}`. But
// `{ // note }` written across lines has no statements *and* a comment
// — collapsing it to `{}` would silently delete the comment. The
// printer must treat the comment-bearing statement-free block as
// uncovered so the formatPrintWidth rule abstains and the comment
// survives byte-identical. A regression that collapsed it would lose
// the comment on the first `ttsc format` pass.
//
//  1. Parse a callback whose body holds only a `// note` comment on its
//     own line.
//  2. Dispatch the enclosing CallExpression through PrintNode.
//  3. Assert `covered` is false.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode of the enclosing call must mark the comment-only callback body uncovered so reflow cannot discard its note.
// @evidence contracts/testing.md#independent-expectations The literal // note has no statement carrier in the reconstructed block, establishing the need to abstain.
// @evidence contracts/testing.md#distinguishing-cases Comment-only content differs from an empty block and ordinary statement bodies; this case asserts coverage, not a rewritten output.
// @evidence contracts/testing.md#execution-ownership TestDispatchBlockReportsUncoveredForCommentOnlyBody is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchBlockReportsUncoveredForCommentOnlyBody(t *testing.T) {
  file := parseTS(t, "foo(() => {\n  // note\n});\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  _, covered := PrintNode(ctx, node)
  if covered {
    t.Fatalf("comment-only block body must be uncovered")
  }
}
