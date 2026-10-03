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
// uncovered. This test checks the enclosing call's coverage flag; it
// does not run formatPrintWidth or assert byte-identical disk output.
//
//  1. Parse a callback whose body holds only a `// note` comment on its
//     own line.
//  2. Dispatch the enclosing CallExpression through PrintNode.
//  3. Assert `covered` is false.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode of the enclosing call must mark the comment-only callback body uncovered so reflow cannot discard its note.
// @evidence contracts/testing.md#independent-expectations The literal // note has no statement carrier in the reconstructed block, establishing the need to abstain.
// @evidence contracts/testing.md#distinguishing-cases Comment-only content differs from an empty block and ordinary statement bodies; this case asserts coverage, not a rewritten output.
// @evidence contracts/testing.md#execution-ownership TestDispatchBlockReportsUncoveredForCommentOnlyBody is a plain top-level Go unit test, selectable with go test -run, that calls PrintNode directly on a parsed call whose callback body holds only a line comment inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchBlockReportsUncoveredForCommentOnlyBody(t *testing.T) {
  file := parseTS(t, "foo(() => {\n  // note\n});\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  _, covered := PrintNode(ctx, node)
  if covered {
    t.Fatalf("comment-only block body must be uncovered")
  }
}
