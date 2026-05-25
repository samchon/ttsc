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
func TestDispatchBlockReportsUncoveredForCommentOnlyBody(t *testing.T) {
  file := parseTS(t, "foo(() => {\n  // note\n});\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  _, covered := PrintNode(ctx, node)
  if covered {
    t.Fatalf("comment-only block body must be uncovered")
  }
}
