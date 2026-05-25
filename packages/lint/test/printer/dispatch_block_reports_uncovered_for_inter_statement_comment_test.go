package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchBlockReportsUncoveredForInterStatementComment verifies the
// block printer reports `covered == false` when the block carries a
// comment that lives between two statements.
//
// printBlock joins statements with bare Hardline separators that have
// no carrier slot for trivia. A comment sitting between statements
// would be silently dropped by a reflow. The printer must surface that
// as `covered == false` so the formatPrintWidth rule abstains and the
// comment survives byte-identical. A regression that ignored the
// comment would delete it on the first `ttsc format` pass.
//
//  1. Parse a callback body with a `// note` comment between two
//     statements.
//  2. Dispatch the enclosing CallExpression through PrintNode.
//  3. Assert `covered` is false.
func TestDispatchBlockReportsUncoveredForInterStatementComment(t *testing.T) {
  file := parseTS(t, "run(() => {\n  a();\n  // note\n  b();\n});\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  _, covered := PrintNode(ctx, node)
  if covered {
    t.Fatalf("block with inter-statement comment must be uncovered")
  }
}
